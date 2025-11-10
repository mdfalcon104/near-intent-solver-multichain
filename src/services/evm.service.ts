import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';

/**
 * EVM Service - Handles EVM chain operations
 * Builds and signs EVM transactions for deposits/withdrawals
 * Supports multiple chains: Arbitrum, Base, Ethereum, Polygon, Aurora, etc.
 */
@Injectable()
export class EvmService {
  private readonly logger = new Logger(EvmService.name);
  private providers: Record<string, ethers.JsonRpcProvider> = {};
  private wallets: Record<string, ethers.Wallet> = {};

  private readonly RPC_ENDPOINTS: Record<string, string> = {
    arbitrum: process.env.ARBITRUM_RPC || 'https://arb1.arbitrum.io/rpc',
    aurora: process.env.AURORA_RPC || 'https://mainnet.aurora.dev',
    ethereum: process.env.ETHEREUM_RPC || 'https://eth.rpc.blxrbdn.com',
    polygon: process.env.POLYGON_RPC || 'https://polygon-rpc.com',
    base: process.env.BASE_RPC || 'https://mainnet.base.org',
    optimism: process.env.OPTIMISM_RPC || 'https://mainnet.optimism.io',
  };

  private readonly ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function balanceOf(address account) returns (uint256)',
    'function decimals() returns (uint8)',
  ];

  getProvider(chain: string) {
    if (this.providers[chain]) return this.providers[chain];
    const rpc = this.RPC_ENDPOINTS[chain.toLowerCase()];
    if (!rpc) {
      throw new Error(`No RPC endpoint configured for chain: ${chain}`);
    }
    const p = new ethers.JsonRpcProvider(rpc);
    this.providers[chain] = p;
    return p;
  }

  getWallet(chain: string) {
    if (this.wallets[chain]) return this.wallets[chain];
    const pk = process.env.EVM_PRIVATE_KEY || '';
    if (!pk) {
      throw new Error('EVM_PRIVATE_KEY not configured');
    }
    const provider = this.getProvider(chain);
    const wallet = new ethers.Wallet(pk, provider);
    this.wallets[chain] = wallet;
    return wallet;
  }

  /**
   * Build and sign a transaction for ERC20 token transfer (deposit)
   * @param chain - Target chain (arbitrum, ethereum, polygon, etc.)
   * @param tokenAddress - ERC20 token contract address
   * @param recipientAddress - Recipient address for the deposit
   * @param amount - Amount in token decimals
   * @returns Signed transaction ready to broadcast
   */
  async buildAndSignDepositTx(
    chain: string,
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
  ): Promise<{
    signedTx: string;
    from: string;
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
    nonce: number;
  }> {
    this.logger.log(
      `[EVM] Building signed deposit transaction on ${chain}...`,
    );
    this.logger.log(`  Token: ${tokenAddress}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const wallet = this.getWallet(chain);
      const provider = this.getProvider(chain);

      // Get current gas price
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

      // Create ERC20 contract interface
      const erc20 = new ethers.Contract(
        tokenAddress,
        this.ERC20_ABI,
        wallet,
      );

      // Build transfer transaction
      const tx = await erc20.transfer.populateTransaction(recipientAddress, amount);

      // Get nonce
      const nonce = await provider.getTransactionCount(wallet.address);

      // Estimate gas
      tx.from = wallet.address;
      tx.gasPrice = gasPrice;
      const gasEstimate = await provider.estimateGas(tx);
      const gasLimit = (gasEstimate * 120n) / 100n; // Add 20% buffer

      // Sign transaction
      tx.gasLimit = gasLimit;
      tx.nonce = nonce;
      const signedTx = await wallet.signTransaction(tx as ethers.TransactionRequest);

      this.logger.log(`[EVM] Deposit transaction signed`);
      this.logger.log(`  From: ${wallet.address}`);
      this.logger.log(`  To: ${tx.to}`);
      this.logger.log(`  Gas Limit: ${gasLimit.toString()}`);
      this.logger.log(`  Nonce: ${nonce}`);

      return {
        signedTx,
        from: wallet.address,
        to: tx.to || '',
        data: tx.data || '0x',
        value: tx.value?.toString() || '0',
        gasLimit: gasLimit.toString(),
        gasPrice: gasPrice.toString(),
        nonce,
      };
    } catch (error) {
      this.logger.error(`[EVM] Failed to build deposit transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Build and sign a transaction for ETH withdrawal or token transfer
   * @param chain - Target chain
   * @param recipientAddress - Recipient address
   * @param amount - Amount in wei (for ETH) or token decimals (for ERC20)
   * @param tokenAddress - Optional ERC20 token address; if empty, transfers ETH
   * @returns Signed transaction ready to broadcast
   */
  async buildAndSignWithdrawTx(
    chain: string,
    recipientAddress: string,
    amount: string,
    tokenAddress?: string,
  ): Promise<{
    signedTx: string;
    from: string;
    to: string;
    data: string;
    value: string;
    gasLimit: string;
    gasPrice: string;
    nonce: number;
  }> {
    this.logger.log(
      `[EVM] Building signed withdrawal transaction on ${chain}...`,
    );
    this.logger.log(`  Recipient: ${recipientAddress}`);
    this.logger.log(`  Amount: ${amount}`);
    if (tokenAddress) {
      this.logger.log(`  Token: ${tokenAddress}`);
    }

    try {
      const wallet = this.getWallet(chain);
      const provider = this.getProvider(chain);

      // Get current gas price
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice || ethers.parseUnits('1', 'gwei');

      // Get nonce
      const nonce = await provider.getTransactionCount(wallet.address);

      let tx: any;

      if (!tokenAddress) {
        // Direct ETH transfer
        tx = {
          to: recipientAddress,
          from: wallet.address,
          value: amount,
          data: '0x',
          gasPrice,
          nonce,
        };

        // Estimate gas for ETH transfer
        const gasEstimate = await provider.estimateGas(tx);
        const gasLimit = (gasEstimate * 120n) / 100n; // Add 20% buffer
        tx.gasLimit = gasLimit;
      } else {
        // ERC20 token transfer
        const erc20 = new ethers.Contract(
          tokenAddress,
          this.ERC20_ABI,
          wallet,
        );

        tx = await erc20.transfer.populateTransaction(recipientAddress, amount);
        tx.from = wallet.address;
        tx.gasPrice = gasPrice;
        tx.nonce = nonce;

        // Estimate gas
        const gasEstimate = await provider.estimateGas(tx);
        const gasLimit = (gasEstimate * 120n) / 100n; // Add 20% buffer
        tx.gasLimit = gasLimit;
      }

      // Sign transaction
      const signedTx = await wallet.signTransaction(tx as ethers.TransactionRequest);

      this.logger.log(`[EVM] Withdrawal transaction signed`);
      this.logger.log(`  From: ${wallet.address}`);
      this.logger.log(`  To: ${tx.to}`);
      this.logger.log(`  Gas Limit: ${tx.gasLimit.toString()}`);
      this.logger.log(`  Nonce: ${nonce}`);

      return {
        signedTx,
        from: wallet.address,
        to: tx.to,
        data: tx.data || '0x',
        value: tx.value?.toString() || '0',
        gasLimit: tx.gasLimit.toString(),
        gasPrice: gasPrice.toString(),
        nonce,
      };
    } catch (error) {
      this.logger.error(`[EVM] Failed to build withdrawal transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Broadcast a signed transaction to the network
   * @param chain - Target chain
   * @param signedTx - Signed transaction hex string
   * @returns Transaction hash and receipt
   */
  async broadcastSignedTx(
    chain: string,
    signedTx: string,
  ): Promise<{
    txHash: string;
    from: string;
    to: string;
    blockNumber: number;
  }> {
    this.logger.log(`[EVM] Broadcasting signed transaction on ${chain}...`);

    try {
      const provider = this.getProvider(chain);
      const txResponse = await provider.broadcastTransaction(signedTx);

      this.logger.log(`[EVM] Transaction broadcasted`);
      this.logger.log(`  TX Hash: ${txResponse.hash}`);
      this.logger.log(`  From: ${txResponse.from}`);
      this.logger.log(`  To: ${txResponse.to}`);

      // Wait for confirmation
      const receipt = await txResponse.wait(1);
      if (!receipt) {
        throw new Error('Transaction failed to confirm');
      }

      return {
        txHash: txResponse.hash,
        from: txResponse.from || '',
        to: txResponse.to || '',
        blockNumber: receipt.blockNumber,
      };
    } catch (error) {
      this.logger.error(`[EVM] Failed to broadcast transaction: ${error}`);
      throw error;
    }
  }

  /**
   * Build and sign, then broadcast a deposit transaction in one call
   */
  async depositAndSign(
    chain: string,
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
  ): Promise<{
    status: string;
    txHash: string;
    from: string;
    to: string;
    amount: string;
    chain: string;
    timestamp: number;
  }> {
    this.logger.log(`[EVM] Executing deposit with signature on ${chain}...`);

    try {
      // Build and sign
      const txData = await this.buildAndSignDepositTx(
        chain,
        tokenAddress,
        recipientAddress,
        amount,
      );

      // Broadcast
      const result = await this.broadcastSignedTx(chain, txData.signedTx);

      return {
        status: 'success',
        txHash: result.txHash,
        from: result.from,
        to: result.to,
        amount,
        chain,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`[EVM] Deposit failed: ${error}`);
      throw error;
    }
  }

  /**
   * Build and sign, then broadcast a withdrawal transaction in one call
   */
  async withdrawAndSign(
    chain: string,
    recipientAddress: string,
    amount: string,
    tokenAddress?: string,
  ): Promise<{
    status: string;
    txHash: string;
    from: string;
    to: string;
    amount: string;
    chain: string;
    timestamp: number;
  }> {
    this.logger.log(`[EVM] Executing withdrawal with signature on ${chain}...`);

    try {
      // Build and sign
      const txData = await this.buildAndSignWithdrawTx(
        chain,
        recipientAddress,
        amount,
        tokenAddress,
      );

      // Broadcast
      const result = await this.broadcastSignedTx(chain, txData.signedTx);

      return {
        status: 'success',
        txHash: result.txHash,
        from: result.from,
        to: result.to,
        amount,
        chain,
        timestamp: Date.now(),
      };
    } catch (error) {
      this.logger.error(`[EVM] Withdrawal failed: ${error}`);
      throw error;
    }
  }

  // Legacy method - broadcast raw transaction
  async sendRawTx(chain: string, rawTx: string) {
    const provider = this.getProvider(chain);
    return provider.broadcastTransaction(rawTx);
  }
}
