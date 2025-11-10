import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import * as fs from 'fs';
import * as path from 'path';

interface TokenInventory {
  address: string;
  symbol: string;
  decimals: number;
  balance: string;
  minBalance: string;
  enabled: boolean;
}

interface ChainInventory {
  chain: string;
  enabled: boolean;
  tokens: Map<string, TokenInventory>;
}

interface InventoryConfig {
  chains: Record<string, {
    enabled: boolean;
    tokens: Array<{
      address: string;
      symbol: string;
      decimals: number;
      minBalance: string;
      currentBalance: string;
      enabled: boolean;
    }>;
  }>;
}

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);
  private inventory: Map<string, ChainInventory> = new Map();
  private configPath: string;
  private rawConfig: InventoryConfig | null = null;

  constructor(private readonly configService: ConfigService) {
    this.configPath = this.configService.get('INVENTORY_CONFIG_PATH') || './inventory.json';
    this.loadInventoryConfig();
  }

  /**
   * Load inventory configuration from JSON file
   */
  private loadInventoryConfig() {
    try {
      const fullPath = path.resolve(process.cwd(), this.configPath);
      
      if (!fs.existsSync(fullPath)) {
        this.logger.warn(`Inventory config not found at ${fullPath}, using empty inventory`);
        return;
      }

      const configData = fs.readFileSync(fullPath, 'utf-8');
      this.rawConfig = JSON.parse(configData) as InventoryConfig;

      this.logger.log(`Loading inventory from ${fullPath}`);

      // Parse each chain
      Object.entries(this.rawConfig.chains).forEach(([chain, chainConfig]) => {
        const tokens = new Map<string, TokenInventory>();

        if (chainConfig.enabled && chainConfig.tokens) {
          chainConfig.tokens.forEach((tokenConfig) => {
            tokens.set(tokenConfig.address.toLowerCase(), {
              address: tokenConfig.address,
              symbol: tokenConfig.symbol,
              decimals: tokenConfig.decimals,
              balance: tokenConfig.currentBalance,
              minBalance: tokenConfig.minBalance,
              enabled: tokenConfig.enabled,
            });
          });
        }

        this.inventory.set(chain.toLowerCase(), {
          chain,
          enabled: chainConfig.enabled,
          tokens,
        });

        if (chainConfig.enabled && tokens.size > 0) {
          const enabledTokens = Array.from(tokens.values()).filter(t => t.enabled);
          this.logger.log(`✅ ${chain}: ${enabledTokens.length} enabled tokens`);
          enabledTokens.forEach((token) => {
            this.logger.log(
              `  - ${token.symbol} (${token.address}): ${this.formatBalance(token.balance, token.decimals)} (min: ${this.formatBalance(token.minBalance, token.decimals)})`,
            );
          });
        }
      });

      this.logger.log(`Inventory loaded successfully`);
    } catch (error) {
      this.logger.error(`Failed to load inventory config: ${error.message}`);
    }
  }

  /**
   * Format balance for display
   */
  private formatBalance(balance: string, decimals: number): string {
    const num = BigInt(balance);
    const divisor = BigInt(10 ** decimals);
    const whole = num / divisor;
    return whole.toString();
  }

  /**
   * Check if we can provide quote for this asset pair
   */
  canProvideQuote(
    originAsset: string,
    destinationAsset: string,
    amountOut: string,
  ): boolean {
    // Parse destination asset: "nep141:sol-5ce3bf3a31af18be40ba30f721101b4341690186.omft.near"
    const { chain, token } = this.parseAssetIdentifier(destinationAsset);

    // Check if chain is enabled
    const chainInventory = this.inventory.get(chain);
    if (!chainInventory?.enabled) {
      this.logger.debug(`Chain ${chain} not enabled in inventory`);
      return false;
    }

    // Check if token is enabled
    const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
    if (!tokenInventory?.enabled) {
      this.logger.debug(`Token ${token} not enabled on ${chain}`);
      return false;
    }

    // Convert amountOut to BigInt (handle decimal/scientific notation)
    const amountOutBigInt = BigInt(Math.floor(Number(amountOut)));

    // Check if we have enough balance
    const hasEnoughBalance = BigInt(tokenInventory.balance) >= amountOutBigInt;
    if (!hasEnoughBalance) {
      this.logger.warn(
        `Insufficient inventory: ${token} on ${chain}. Have: ${tokenInventory.balance}, Need: ${amountOut}`,
      );
      return false;
    }

    // Check minimum balance threshold
    const remainingAfter = BigInt(tokenInventory.balance) - amountOutBigInt;
    const meetsMinimum = remainingAfter >= BigInt(tokenInventory.minBalance);
    if (!meetsMinimum) {
      this.logger.warn(
        `Would fall below minimum balance: ${token} on ${chain}. Min: ${tokenInventory.minBalance}, Would have: ${remainingAfter}`,
      );
      return false;
    }

    return true;
  }

  /**
   * Reserve inventory for a quote
   */
  reserveInventory(
    quoteId: string,
    destinationAsset: string,
    amount: string,
  ): boolean {
    const { chain, token } = this.parseAssetIdentifier(destinationAsset);
    const chainInventory = this.inventory.get(chain);
    
    if (!chainInventory) {
      return false;
    }

    const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
    if (!tokenInventory) {
      return false;
    }

    // Deduct from available balance
    const newBalance = BigInt(tokenInventory.balance) - BigInt(amount);
    tokenInventory.balance = newBalance.toString();

    this.logger.log(
      `Reserved ${amount} ${token} on ${chain} for quote ${quoteId}. New balance: ${tokenInventory.balance}`,
    );

    return true;
  }

  /**
   * Release reserved inventory (if quote not filled)
   */
  releaseInventory(
    quoteId: string,
    destinationAsset: string,
    amount: string,
  ) {
    const { chain, token } = this.parseAssetIdentifier(destinationAsset);
    const chainInventory = this.inventory.get(chain);
    
    if (!chainInventory) {
      return;
    }

    const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
    if (!tokenInventory) {
      return;
    }

    // Add back to available balance
    const newBalance = BigInt(tokenInventory.balance) + BigInt(amount);
    tokenInventory.balance = newBalance.toString();

    this.logger.log(
      `Released ${amount} ${token} on ${chain} for quote ${quoteId}. New balance: ${tokenInventory.balance}`,
    );
  }

  /**
   * Parse defuse asset identifier
   * Format: "nep141:arb-0xaf88d065e77c8cc2239327c5edb3a432268e5831.omft.near"
   * Returns: { chain: 'arbitrum', token: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' }
   */
  private parseAssetIdentifier(assetId: string): { chain: string; token: string } {
    // Remove "nep141:" prefix
    const withoutPrefix = assetId.replace(/^nep141:/, '');

    // Check if it's a native NEAR token
    if (!withoutPrefix.includes('-')) {
      return {
        chain: 'near',
        token: withoutPrefix,
      };
    }

    // Parse cross-chain token: "arb-0xaf88...omft.near"
    const parts = withoutPrefix.split('-');
    if (parts.length < 2) {
      throw new Error(`Invalid asset identifier: ${assetId}`);
    }

    const chainPrefix = parts[0]; // "arb", "eth", "sol", "btc"
    const tokenAddress = parts.slice(1).join('-').replace('.omft.near', ''); // "0xaf88..."

    // Map chain prefix to full chain name
    const chainMap: Record<string, string> = {
      arb: 'arbitrum',
      eth: 'ethereum',
      sol: 'solana',
      btc: 'bitcoin',
      poly: 'polygon',
      avax: 'avalanche',
      bnb: 'bsc',
      op: 'optimism',
      base: 'base',
      aurora: 'aurora',
    };

    const chain = chainMap[chainPrefix] || chainPrefix;

    return { chain, token: tokenAddress };
  }

  /**
   * Get inventory summary
   */
  getInventorySummary() {
    const summary: any = {};

    this.inventory.forEach((chainInventory, chain) => {
      if (chainInventory.enabled) {
        summary[chain] = {
          enabled: true,
          tokens: {},
        };

        chainInventory.tokens.forEach((tokenInfo, tokenAddress) => {
          summary[chain].tokens[tokenAddress] = {
            symbol: tokenInfo.symbol,
            balance: tokenInfo.balance,
            minBalance: tokenInfo.minBalance,
            enabled: tokenInfo.enabled,
          };
        });
      }
    });

    return summary;
  }

  /**
   * Reload inventory from JSON file
   */
  reloadInventory() {
    this.logger.log('Reloading inventory configuration...');
    this.inventory.clear();
    this.rawConfig = null;
    this.loadInventoryConfig();
  }

  /**
   * Get raw inventory configuration
   * Used by SimplePricingService to load address_price mappings
   */
  getRawConfig(): InventoryConfig | null {
    return this.rawConfig;
  }

  /**
   * Update token balance (called after transfers)
   */
  updateBalance(chain: string, token: string, newBalance: string) {
    const chainInventory = this.inventory.get(chain.toLowerCase());
    if (!chainInventory) {
      return;
    }

    const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
    if (!tokenInventory) {
      return;
    }

    tokenInventory.balance = newBalance;
    this.logger.log(`Updated ${token} balance on ${chain}: ${newBalance}`);
  }
}
