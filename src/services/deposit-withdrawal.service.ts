import { Injectable, Logger } from '@nestjs/common';
import { NearService } from './near.service';
import { ConfigService } from '../config/config.service';
import { ChaindefuserBridgeService } from './chaindefuser-bridge.service';
import { EvmService } from './evm.service';

/**
 * Market Maker Deposit/Withdrawal Service
 * Implements passive deposit and withdrawal functionality per NEAR Intents spec
 * Integrates with Chaindefuser Bridge for cross-chain deposits/withdrawals
 * https://docs.near-intents.org/near-intents/market-makers/passive-deposit-withdrawal-service
 * https://bridge.chaindefuser.com/rpc
 */
@Injectable()
export class DepositWithdrawalService {
  private readonly logger = new Logger(DepositWithdrawalService.name);

  constructor(
    private near: NearService,
    private config: ConfigService,
    private bridge: ChaindefuserBridgeService,
    private evm: EvmService,
  ) {}

  /**
   * Get solver account balance for a specific token
   */
  async getBalance(token_id: string = 'NEAR'): Promise<string> {
    this.logger.log(`[Balance] Querying balance for ${token_id}...`);

    try {
      const solverAccount = this.config.get('NEAR_ACCOUNT_ID');

      if (token_id === 'NEAR' || token_id === 'near') {
        // Query NEAR balance from account state
        const response = await this.near.viewFunction(
          solverAccount,
          'state',
          {},
        );
        const result = JSON.parse(
          Buffer.from((response as any).result).toString(),
        );
        const balance = result.amount || '0';

        this.logger.log(`[Balance] NEAR balance: ${balance}`);
        return balance;
      } else {
        // Query token balance
        const response = await this.near.viewFunction(
          token_id,
          'ft_balance_of',
          { account_id: solverAccount },
        );
        const result = JSON.parse(
          Buffer.from((response as any).result).toString(),
        );
        const balance = result || '0';

        this.logger.log(`[Balance] Token balance: ${balance}`);
        return balance;
      }
    } catch (error) {
      this.logger.error(`[Balance] Failed to query balance: ${error}`);
      throw error;
    }
  }

  /**
   * Get available balance (not locked in quotes)
   */
  async getAvailableBalance(token_id: string = 'NEAR'): Promise<string> {
    this.logger.log(`[Available] Checking available balance for ${token_id}...`);

    try {
      const totalBalance = await this.getBalance(token_id);
      const lockedAmount = await this.getLockedAmount(token_id);

      const available =
        BigInt(totalBalance) - BigInt(lockedAmount);

      this.logger.log(`[Available] Total: ${totalBalance}`);
      this.logger.log(`[Available] Locked: ${lockedAmount}`);
      this.logger.log(`[Available] Available: ${available.toString()}`);

      return available.toString();
    } catch (error) {
      this.logger.error(
        `[Available] Failed to get available balance: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get amount locked in active quotes
   */
  private async getLockedAmount(token_id: string): Promise<string> {
    // TODO: Query inventory service for locked amounts
    // For now, return 0
    return '0';
  }

  /**
   * Get deposit/withdrawal history
   */
  async getDepositWithdrawalHistory(
    limit: number = 10,
  ): Promise<
    Array<{
      type: 'deposit' | 'withdrawal';
      amount: string;
      token: string;
      txHash: string;
      timestamp: number;
      status: string;
    }>
  > {
    this.logger.log(`[History] Querying deposit/withdrawal history...`);

    try {
      // TODO: Query transaction history from NEAR
      // For now, return empty array
      return [];
    } catch (error) {
      this.logger.error(`[History] Failed to get history: ${error}`);
      throw error;
    }
  }

  /**
   * Get deposit/withdrawal account statistics
   */
  async getAccountStats(): Promise<{
    solver_account: string;
    total_deposited: string;
    total_withdrawn: string;
    current_balance: string;
    available_balance: string;
    locked_balance: string;
    last_activity: number;
  }> {
    this.logger.log(`[Stats] Gathering account statistics...`);

    try {
      const solverAccount = this.config.get('NEAR_ACCOUNT_ID');
      const nearBalance = await this.getBalance('NEAR');
      const availableBalance = await this.getAvailableBalance('NEAR');
      const lockedBalance = (
        BigInt(nearBalance) - BigInt(availableBalance)
      ).toString();

      return {
        solver_account: solverAccount,
        total_deposited: '0',
        total_withdrawn: '0',
        current_balance: nearBalance,
        available_balance: availableBalance,
        locked_balance: lockedBalance,
        last_activity: Date.now(),
      };
    } catch (error) {
      this.logger.error(`[Stats] Failed to get account stats: ${error}`);
      throw error;
    }
  }

  /**
   * ========== Chaindefuser Bridge Integration Methods ==========
   */

  /**
   * Get supported assets from Chaindefuser Bridge
   * Based on inventory.json token mapping
   */
  async getSupportedAssets(): Promise<
    Array<{
      network: string;
      symbol: string;
      address: string;
      decimals: number;
      isNative: boolean;
    }>
  > {
    this.logger.log(
      `[Bridge] Getting supported assets from Chaindefuser...`,
    );

    try {
      const assets = await this.bridge.getSupportedAssets();
      this.logger.log(
        `[Bridge] Retrieved ${assets.length} supported assets`,
      );
      return assets;
    } catch (error) {
      this.logger.error(`[Bridge] Failed to get supported assets: ${error}`);
      throw error;
    }
  }

  /**
   * Deposit via Chaindefuser Bridge
   * Supports cross-chain deposits (Arbitrum, Base, etc. → NEAR)
   */
  async depositViaBridge(
    symbol: string,
    chain: string,
    amount: string,
  ): Promise<{
    status: string;
    txHash: string;
    chain: string;
    symbol: string;
    amount: string;
    deposited_at: number;
    depositAddress: string;
  }> {
    this.logger.log(`[Bridge] Initiating auto-deposit via bridge...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      // Validate token is supported
      if (!this.bridge.isTokenSupported(symbol, chain)) {
        throw new Error(
          `Token ${symbol} is not supported on chain ${chain}`,
        );
      }

      // Get deposit address from Chaindefuser
      const depositInfo = await this.bridge.depositFunds(
        symbol,
        chain,
        amount,
      );

      this.logger.log(`[Bridge] Deposit address obtained`);
      this.logger.log(
        `  Address: ${depositInfo.depositAddress}`,
      );

      // Auto-execute deposit based on chain type
      let txHash: string;
      
      if (chain.toLowerCase() === 'near') {
        // Deposit on NEAR chain
        txHash = await this.depositToNearViaAddress(
          symbol,
          depositInfo.depositAddress,
          amount,
        );
      } else {
        // Deposit on EVM chain (Arbitrum, Ethereum, Polygon, Base, etc.)
        txHash = await this.depositToEvmViaAddress(
          chain,
          symbol,
          depositInfo.depositAddress,
          amount,
        );
      }

      this.logger.log(`[Bridge] Auto-deposit completed`);
      this.logger.log(`  TX: ${txHash}`);

      return {
        status: 'success',
        txHash,
        chain,
        symbol,
        amount,
        deposited_at: Date.now(),
        depositAddress: depositInfo.depositAddress,
      };
    } catch (error) {
      this.logger.error(`[Bridge] Auto-deposit failed: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Auto-deposit to NEAR via deposit address
   */
  private async depositToNearViaAddress(
    tokenId: string,
    recipientAddress: string,
    amount: string,
  ): Promise<string> {
    this.logger.log(`[Bridge] Executing NEAR deposit...`);
    this.logger.log(`  Token: ${tokenId}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const tx = await this.near.functionCall(
        tokenId,
        'ft_transfer_call',
        {
          receiver_id: recipientAddress,
          amount: amount,
          msg: JSON.stringify({ action: 'bridge_deposit' }),
        },
        '100000000000000',
        '1',
      );

      return tx.transaction.hash;
    } catch (error) {
      this.logger.error(`[Bridge] NEAR deposit failed: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Auto-deposit to EVM via deposit address
   */
  private async depositToEvmViaAddress(
    chain: string,
    symbol: string,
    recipientAddress: string,
    amount: string,
  ): Promise<string> {
    this.logger.log(`[Bridge] Executing EVM deposit on ${chain}...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      // Get token address from inventory
      const tokenInfo = this.bridge['tokenMapping'].get(`${symbol}:${chain}`);
      if (!tokenInfo) {
        throw new Error(`Token ${symbol} not found on chain ${chain}`);
      }

      const tokenAddress = tokenInfo.get('address');
      
      // Execute EVM deposit
      const result = await this.evm.depositAndSign(
        chain,
        tokenAddress,
        recipientAddress,
        amount,
      );

      return result.txHash;
    } catch (error) {
      this.logger.error(`[Bridge] EVM deposit failed: ${error}`);
      throw error;
    }
  }

  /**
   * Withdraw via Chaindefuser Bridge with auto-execution
   * Gets withdrawal details from Chaindefuser, then automatically withdraws via NEAR or EVM
   */
  async withdrawViaBridge(
    symbol: string,
    chain: string,
    amount: string,
    recipientAddress: string,
  ): Promise<{
    status: string;
    txHash: string;
    chain: string;
    symbol: string;
    amount: string;
    withdrawn_at: number;
  }> {
    this.logger.log(`[Bridge] Initiating auto-withdrawal via bridge...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);

    try {
      // Validate token is supported
      if (!this.bridge.isTokenSupported(symbol, chain)) {
        throw new Error(
          `Token ${symbol} is not supported on chain ${chain}`,
        );
      }

      // Check available balance first
      const availableBalance = await this.getAvailableBalance(symbol);
      if (BigInt(amount) > BigInt(availableBalance)) {
        throw new Error(
          `Insufficient available balance. Available: ${availableBalance}, Requested: ${amount}`,
        );
      }

      // Get withdrawal address from Chaindefuser
      const withdrawalInfo = await this.bridge.withdrawFunds(
        symbol,
        chain,
        amount,
        recipientAddress,
      );

      this.logger.log(`[Bridge] Withdrawal address obtained`);
      this.logger.log(`  Address: ${recipientAddress}`);

      // Auto-execute withdrawal based on chain type
      let txHash: string;
      
      if (chain.toLowerCase() === 'near') {
        // Withdraw on NEAR chain
        txHash = await this.withdrawFromNearViaAddress(
          symbol,
          recipientAddress,
          amount,
        );
      } else {
        // Withdraw on EVM chain
        txHash = await this.withdrawFromEvmViaAddress(
          chain,
          symbol,
          recipientAddress,
          amount,
        );
      }

      this.logger.log(`[Bridge] Auto-withdrawal completed`);
      this.logger.log(`  TX: ${txHash}`);

      return {
        status: 'success',
        txHash,
        chain,
        symbol,
        amount,
        withdrawn_at: Date.now(),
      };
    } catch (error) {
      this.logger.error(`[Bridge] Auto-withdrawal failed: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Auto-withdraw from NEAR via address
   */
  private async withdrawFromNearViaAddress(
    tokenId: string,
    recipientAddress: string,
    amount: string,
  ): Promise<string> {
    this.logger.log(`[Bridge] Executing NEAR withdrawal...`);
    this.logger.log(`  Token: ${tokenId}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const tx = await this.near.functionCall(
        tokenId,
        'ft_transfer',
        {
          receiver_id: recipientAddress,
          amount: amount,
          memo: 'Bridge withdrawal',
        },
        '100000000000000',
        '1',
      );

      return tx.transaction.hash;
    } catch (error) {
      this.logger.error(`[Bridge] NEAR withdrawal failed: ${error}`);
      throw error;
    }
  }

  /**
   * Helper: Auto-withdraw from EVM via address
   */
  private async withdrawFromEvmViaAddress(
    chain: string,
    symbol: string,
    recipientAddress: string,
    amount: string,
  ): Promise<string> {
    this.logger.log(`[Bridge] Executing EVM withdrawal on ${chain}...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      // Get token address from inventory
      const tokenInfo = this.bridge['tokenMapping'].get(`${symbol}:${chain}`);
      if (!tokenInfo) {
        throw new Error(`Token ${symbol} not found on chain ${chain}`);
      }

      const tokenAddress = tokenInfo.get('address');
      
      // Execute EVM withdrawal
      const result = await this.evm.withdrawAndSign(
        chain,
        recipientAddress,
        amount,
        tokenAddress,
      );

      return result.txHash;
    } catch (error) {
      this.logger.error(`[Bridge] EVM withdrawal failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get recent deposits via Chaindefuser Bridge
   */
  async getRecentDepositsViaBridge(
    address: string,
    limit: number = 10,
  ): Promise<
    Array<{
      txHash: string;
      network: string;
      asset: string;
      amount: string;
      timestamp: number;
      status: 'pending' | 'confirmed' | 'completed';
    }>
  > {
    this.logger.log(
      `[Bridge] Getting recent deposits for ${address}...`,
    );

    try {
      const deposits = await this.bridge.getRecentDeposits(address, limit);
      this.logger.log(
        `[Bridge] Retrieved ${deposits.length} recent deposits`,
      );
      return deposits;
    } catch (error) {
      this.logger.error(`[Bridge] Failed to get recent deposits: ${error}`);
      throw error;
    }
  }

  /**
   * Get withdrawal status via Chaindefuser Bridge
   */
  async getWithdrawalStatusViaBridge(
    withdrawalId: string,
  ): Promise<{
    withdrawalId: string;
    txHash: string;
    network: string;
    asset: string;
    amount: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    estimatedTime?: number;
  }> {
    this.logger.log(
      `[Bridge] Getting withdrawal status for ${withdrawalId}...`,
    );

    try {
      const status = await this.bridge.getWithdrawalStatus(withdrawalId);
      this.logger.log(`[Bridge] Status: ${status.status}`);
      return status;
    } catch (error) {
      this.logger.error(`[Bridge] Failed to get withdrawal status: ${error}`);
      throw error;
    }
  }

  /**
   * Notify bridge about deposit transaction
   */
  async notifyDepositTransaction(
    txHash: string,
    chain: string,
    symbol: string,
    amount: string,
  ): Promise<{ status: string; message: string }> {
    this.logger.log(
      `[Bridge] Notifying deposit transaction...`,
    );
    this.logger.log(`  TX: ${txHash}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const result = await this.bridge.notifyDeposit(
        txHash,
        chain,
        symbol,
        amount,
      );
      this.logger.log(`[Bridge] Deposit notification sent`);
      return result;
    } catch (error) {
      this.logger.error(
        `[Bridge] Failed to notify deposit: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Estimate withdrawal fee via Chaindefuser Bridge
   */
  async estimateWithdrawalFeeViaBridge(
    symbol: string,
    chain: string,
    amount: string,
  ): Promise<{
    asset: string;
    network: string;
    amount: string;
    fee: string;
    feePercentage: number;
    total: string;
    estimatedTime: number;
  }> {
    this.logger.log(
      `[Bridge] Estimating withdrawal fee...`,
    );
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const estimate = await this.bridge.estimateWithdrawalFee(
        symbol,
        chain,
        amount,
      );
      this.logger.log(`[Bridge] Fee estimated: ${estimate.fee}`);
      return estimate;
    } catch (error) {
      this.logger.error(
        `[Bridge] Failed to estimate fee: ${error}`,
      );
      throw error;
    }
  }

  /**
   * Get supported tokens for a chain
   */
  getChainTokens(chain: string): Array<{
    symbol: string;
    address: string;
    decimals: number;
  }> {
    this.logger.log(`[Bridge] Getting tokens for chain: ${chain}`);
    return this.bridge.getChainTokens(chain);
  }
}