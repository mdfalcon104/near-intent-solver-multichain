import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
import { ConfigService } from '../config/config.service';
import { InventoryService } from './inventory.service';

/**
 * ERC20 Transfer Executor Service
 * Handles cross-chain token transfers when quotes are filled
 */
@Injectable()
export class TransferExecutorService {
  private readonly logger = new Logger(TransferExecutorService.name);
  private providers: Map<string, ethers.Provider> = new Map();
  private signers: Map<string, ethers.Wallet> = new Map();

  // ERC20 ABI for transfer function
  private readonly ERC20_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address account) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function approve(address spender, uint256 amount) returns (bool)',
  ];

  constructor(
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
  ) {
    this.initializeProviders();
  }

  /**
   * Initialize providers and signers for each chain
   */
  private initializeProviders() {
    const chains = [
      { name: 'arbitrum', rpcEnv: 'CHAIN_ARBITRUM_RPC_URL', keyEnv: 'CHAIN_ARBITRUM_PRIVATE_KEY' },
      { name: 'base', rpcEnv: 'CHAIN_BASE_RPC_URL', keyEnv: 'CHAIN_BASE_PRIVATE_KEY' },
      { name: 'ethereum', rpcEnv: 'CHAIN_ETHEREUM_RPC_URL', keyEnv: 'CHAIN_ETHEREUM_PRIVATE_KEY' },
      { name: 'polygon', rpcEnv: 'CHAIN_POLYGON_RPC_URL', keyEnv: 'CHAIN_POLYGON_PRIVATE_KEY' },
    ];

    for (const chain of chains) {
      const rpcUrl = this.configService.get(chain.rpcEnv);
      const privateKey = this.configService.get(chain.keyEnv);

      if (rpcUrl && privateKey) {
        try {
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          this.providers.set(chain.name, provider);

          const signer = new ethers.Wallet(privateKey, provider);
          this.signers.set(chain.name, signer);

          this.logger.log(`✅ Initialized ${chain.name} provider and signer`);
          this.logger.log(`   Address: ${signer.address}`);
        } catch (error) {
          this.logger.warn(`⚠️  Failed to initialize ${chain.name}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Execute ERC20 transfer on specified chain
   * @param chainName - Name of the chain (arbitrum, base, ethereum, polygon)
   * @param tokenAddress - ERC20 token address
   * @param recipientAddress - Recipient wallet address
   * @param amount - Amount to transfer (in smallest units, e.g., wei for 18-decimal tokens)
   * @param quoteId - Associated quote ID for tracking
   */
  async executeTransfer(
    chainName: string,
    tokenAddress: string,
    recipientAddress: string,
    amount: string,
    quoteId: string,
  ): Promise<{ txHash: string; status: string }> {
    this.logger.log(
      `[Transfer] Executing transfer on ${chainName} for quote ${quoteId}`,
    );

    const provider = this.providers.get(chainName);
    const signer = this.signers.get(chainName);

    if (!provider || !signer) {
      const errorMsg = `No signer configured for chain: ${chainName}`;
      this.logger.error(`[Transfer] ❌ ${errorMsg}`);
      throw new Error(errorMsg);
    }

    try {
      // Validate addresses
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(recipientAddress)) {
        throw new Error('Invalid token or recipient address');
      }

      // Create contract instance
      const tokenContract = new ethers.Contract(tokenAddress, this.ERC20_ABI, signer);

      // Log transfer details
      this.logger.log(`[Transfer] Details:`);
      this.logger.log(`  Chain: ${chainName}`);
      this.logger.log(`  Token: ${tokenAddress}`);
      this.logger.log(`  To: ${recipientAddress}`);
      this.logger.log(`  Amount: ${amount}`);
      this.logger.log(`  From: ${signer.address}`);

      // Check balance before transfer
      const balance = await tokenContract.balanceOf(signer.address);
      this.logger.log(`  Balance: ${balance.toString()}`);

      if (balance < BigInt(amount)) {
        throw new Error(
          `Insufficient balance. Have: ${balance.toString()}, Need: ${amount}`,
        );
      }

      // Execute transfer
      this.logger.log(`[Transfer] Sending transaction...`);
      const tx = await tokenContract.transfer(recipientAddress, amount);

      this.logger.log(`[Transfer] ✅ Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();

      if (receipt?.status === 1) {
        this.logger.log(`[Transfer] ✅ Transfer confirmed in block ${receipt.blockNumber}`);
        return {
          txHash: tx.hash,
          status: 'confirmed',
        };
      } else {
        this.logger.error(`[Transfer] ❌ Transaction failed`);
        throw new Error('Transaction failed');
      }
    } catch (error) {
      this.logger.error(`[Transfer] ❌ Error executing transfer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Execute batch transfers (for multiple recipients)
   */
  async executeBatchTransfers(
    chainName: string,
    tokenAddress: string,
    transfers: Array<{ recipient: string; amount: string }>,
    quoteId: string,
  ): Promise<{ txHash: string; status: string }[]> {
    this.logger.log(
      `[Batch Transfer] Executing ${transfers.length} transfers on ${chainName}`,
    );

    const results = [];

    for (const transfer of transfers) {
      try {
        const result = await this.executeTransfer(
          chainName,
          tokenAddress,
          transfer.recipient,
          transfer.amount,
          quoteId,
        );
        results.push(result);
      } catch (error) {
        this.logger.error(
          `[Batch Transfer] Failed for ${transfer.recipient}: ${error.message}`,
        );
        results.push({
          txHash: '',
          status: 'failed',
        });
      }
    }

    return results;
  }

  /**
   * Get chain balance
   */
  async getTokenBalance(
    chainName: string,
    tokenAddress: string,
  ): Promise<{ balance: string; decimals: number }> {
    const signer = this.signers.get(chainName);

    if (!signer) {
      throw new Error(`No signer configured for chain: ${chainName}`);
    }

    const tokenContract = new ethers.Contract(
      tokenAddress,
      this.ERC20_ABI,
      signer,
    );

    const balance = await tokenContract.balanceOf(signer.address);
    const decimals = await tokenContract.decimals();

    return {
      balance: balance.toString(),
      decimals,
    };
  }

  /**
   * Get available signer addresses
   */
  getSignerAddresses(): Record<string, string> {
    const addresses: Record<string, string> = {};

    for (const [chainName, signer] of this.signers.entries()) {
      addresses[chainName] = signer.address;
    }

    return addresses;
  }

  /**
   * Check if chain is configured
   */
  isChainConfigured(chainName: string): boolean {
    return this.providers.has(chainName) && this.signers.has(chainName);
  }
}
