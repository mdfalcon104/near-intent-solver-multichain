import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { InventoryService } from './inventory.service';
import axios from 'axios';

/**
 * Simple pricing service that calculates quotes using Binance API for real-time prices
 */
@Injectable()
export class SimplePricingService implements OnModuleInit {
  private readonly logger = new Logger(SimplePricingService.name);
  private readonly markupPct: number;

  // Price cache with TTL
  private readonly priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly cacheTTL = 60000; // 60 seconds

  // Fallback prices (used when Binance API fails)
  private readonly fallbackPrices: Record<string, number> = {
    'usdt.tether-token.near': 1.0,
    'usdc.tether-token.near': 1.0,
    'eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near': 1.0,
    'eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near': 1.0,
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 1.0,
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1.0,
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 1.0,
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 1.0,
    'wrap.near': 5.0,
    'btc.omft.near': 98000.0,
    'eth.omft.near': 3500.0,
    'native': 600.0, // BNB
  };

  // Chain ID mapping for Binance API
  private readonly chainIdMap: Record<string, string> = {
    ethereum: '1',
    arbitrum: '42161',
    polygon: '137',
    bsc: '56',
    avalanche: '43114',
    bitcoin: 'bitcoin',
    near: 'near',
    solana: 'solana',
  };

  // Token address mapping to Binance-compatible format
  private readonly tokenMapping: Record<string, { chainId: string; address: string }> = {
    // NEAR tokens
    'usdt.tether-token.near': { chainId: '56', address: '0x55d398326f99059ff775485246999027b3197955' }, // BSC USDT as reference
    'usdc.tether-token.near': { chainId: '56', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' }, // BSC USDC
    'wrap.near': { chainId: 'near', address: 'near' },
    'btc.omft.near': { chainId: 'bitcoin', address: 'bitcoin' },
    
    // Ethereum tokens
    'eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near': { chainId: '1', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
    'eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near': { chainId: '1', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
    'eth.omft.near': { chainId: '1', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }, // ETH native
    
    // Direct addresses (EVM)
    '0xdac17f958d2ee523a2206206994597c13d831ec7': { chainId: '1', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { chainId: '1', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { chainId: '42161', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' },
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { chainId: '42161', address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9' },
    
    // Native tokens
    'native': { chainId: '56', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' }, // Default to BNB
  };

  private readonly decimals: Record<string, number> = {
    'usdt.tether-token.near': 6,
    'usdc.tether-token.near': 6,
    'eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near': 6,
    'eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near': 6,
    '0xdac17f958d2ee523a2206206994597c13d831ec7': 6,
    '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 6,
    '0xaf88d065e77c8cc2239327c5edb3a432268e5831': 6,
    '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': 6,
    'wrap.near': 24,
    'btc.omft.near': 8,
    'native': 8,
  };

  constructor(
    private readonly configService: ConfigService,
    private readonly inventoryService: InventoryService,
  ) {
    this.markupPct = parseFloat(
      this.configService.get('MARKUP_PCT') || '0.005',
    ); // 0.5% default
    this.logger.log(`Initialized with ${this.markupPct * 100}% markup, using OKX (backup) + fallback for pricing`);
  }

  /**
   * Load token mappings from inventory on module init
   */
  async onModuleInit(): Promise<void> {
    try {
      await this.loadTokenMappingsFromInventory();
      this.logger.log('✅ Token mappings loaded from inventory');
    } catch (error) {
      this.logger.warn(`⚠️ Failed to load token mappings from inventory: ${error.message}`);
    }
  }

  /**
   * Load token price mappings from inventory configuration
   * Reads address_price and chainId_price fields from inventory.json
   */
  private async loadTokenMappingsFromInventory(): Promise<void> {
    const config = this.inventoryService.getRawConfig();
    
    if (!config || !config.chains) {
      this.logger.warn('No chains found in inventory');
      return;
    }

    let mappingsAdded = 0;

    for (const [chainName, chainConfig] of Object.entries(config.chains)) {
      const typed = chainConfig as any;
      if (!typed || !typed.tokens) continue;

      for (const token of typed.tokens) {
        // Check if token has address_price field (new field for price lookups)
        if (!token.address_price || !token.chainId_price) {
          continue; // Skip tokens without price mapping
        }

        // Register mapping: token.address -> { chainId, address_price }
        this.tokenMapping[token.address] = {
          chainId: token.chainId_price as string,
          address: token.address_price as string,
        };

        // Also set fallback price if it doesn't exist
        if (!this.fallbackPrices[token.address]) {
          // Default fallback: USDT/USDC = $1, others = $0.01
          const symbol = (token.symbol || '').toUpperCase();
          if (symbol.includes('USDT') || symbol.includes('USDC')) {
            this.fallbackPrices[token.address] = 1.0;
          } else if (symbol.includes('ETH') || symbol.includes('WETH')) {
            this.fallbackPrices[token.address] = 3500.0;
          } else if (symbol.includes('BTC')) {
            this.fallbackPrices[token.address] = 98000.0;
          } else if (symbol.includes('NEAR') || symbol.includes('WNEAR')) {
            this.fallbackPrices[token.address] = 5.0;
          } else {
            this.fallbackPrices[token.address] = 0.01;
          }
        }

        this.logger.debug(
          `Registered price mapping for ${token.symbol} (${token.address}): chainId=${token.chainId_price}, address=${token.address_price}`,
        );
        mappingsAdded++;
      }
    }

    this.logger.log(`✅ Loaded ${mappingsAdded} token price mappings from inventory`);
  }

  /**
   * Reload token mappings from inventory
   * Can be called to refresh mappings after inventory updates
   */
  async reloadTokenMappings(): Promise<void> {
    this.logger.log('Reloading token mappings from inventory...');
    await this.loadTokenMappingsFromInventory();
  }

  /**
   * Fetch token price from Binance API (Primary)
   */
  private async fetchPriceFromBinance(chainId: string, contractAddress: string): Promise<number | null> {
    try {
      const url = `https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/token/price/info?chainId=${chainId}&contractAddress=${contractAddress}`;
      
      this.logger.debug(`Fetching price from Binance: chainId=${chainId}, address=${contractAddress}`);
      
      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
      });

      if (response.data?.data?.priceInUsd) {
        const price = parseFloat(response.data.data.priceInUsd);
        this.logger.debug(`Binance price for ${contractAddress} on chain ${chainId}: $${price}`);
        return price;
      }

      this.logger.warn(`No price data from Binance for ${contractAddress} on chain ${chainId}`);
      return null;
    } catch (error) {
      this.logger.debug(`Binance API failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Fetch token price from OKX API (Backup)
   * Uses candle data - latest price is the first row's close price
   */
  private async fetchPriceFromOkx(chainId: string, contractAddress: string): Promise<number | null> {
    try {
      const now = Date.now();
      const after = now; // OKX uses 'after' timestamp
      const url = `https://web3.okx.com/priapi/v5/dex/token/market/dex-token-hlc-candles?chainId=${chainId}&address=${contractAddress}&after=${after}&bar=1m&limit=1`;
      
      this.logger.debug(`Fetching price from OKX: chainId=${chainId}, address=${contractAddress}`);
      
      const response = await axios.get(url, {
        timeout: 3000,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          'Accept': 'application/json',
        },
      });

      // OKX returns: {code: "0", data: [[timestamp, open, high, low, close, volume]]}
      if (response.data?.code === "0" && response.data?.data && response.data.data.length > 0) {
        const firstCandle = response.data.data[0];
        if (firstCandle && firstCandle.length >= 5) {
          const closePrice = parseFloat(firstCandle[4]); // Index 4 is close price
          if (closePrice > 0) {
            this.logger.debug(`OKX price for ${contractAddress} on chain ${chainId}: $${closePrice}`);
            return closePrice;
          }
        }
      }

      this.logger.warn(`No price data from OKX for ${contractAddress} on chain ${chainId}`);
      return null;
    } catch (error) {
      this.logger.debug(`OKX API failed: ${error.message}`);
      return null;
    }
  }

  /**
   * Get token price with caching
   */
  private async getTokenPriceUsd(tokenAddress: string): Promise<number | null> {
    const cacheKey = tokenAddress;
    const cached = this.priceCache.get(cacheKey);

    // Return cached price if still valid
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      this.logger.debug(`Using cached price for ${tokenAddress}: $${cached.price}`);
      return cached.price;
    }

    // Try to fetch from API if we have mapping
    const mapping = this.tokenMapping[tokenAddress];
    if (mapping) {
      // 1. Try Binance first (primary)
      let price = await this.fetchPriceFromBinance(mapping.chainId, mapping.address);
      
      if (price !== null && price > 0) {
        this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
        this.logger.log(`✅ Binance price for ${tokenAddress}: $${price}`);
        return price;
      }

      // 2. Try OKX as backup
      price = await this.fetchPriceFromOkx(mapping.chainId, mapping.address);
      
      if (price !== null && price > 0) {
        this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
        this.logger.log(`✅ OKX price for ${tokenAddress}: $${price}`);
        return price;
      }
    }

    // 3. Fallback to static prices (last resort)
    const fallbackPrice = this.fallbackPrices[tokenAddress];
    if (fallbackPrice) {
      this.logger.log(`⚠️ Using fallback price for ${tokenAddress}: $${fallbackPrice}`);
      this.priceCache.set(cacheKey, { price: fallbackPrice, timestamp: Date.now() });
      return fallbackPrice;
    }

    this.logger.warn(`❌ No price found for token: ${tokenAddress}`);
    return null;
  }

  /**
   * Calculate quote for cross-chain swap
   * Returns null if tokens don't have price mappings (will skip quote)
   */
  async calculateQuote(params: {
    originAsset: string;
    destinationAsset: string;
    amount: string;
  }): Promise<{ amountOut: string; rate: number } | null> {
    const { originAsset, destinationAsset, amount } = params;

    // Extract token addresses from defuse identifiers
    const originToken = this.extractTokenAddress(originAsset);
    const destToken = this.extractTokenAddress(destinationAsset);

    this.logger.debug(
      `Calculating quote: ${originToken} -> ${destToken}, amount: ${amount}`,
    );

    // Get prices from Binance API
    const originPrice = await this.getTokenPriceUsd(originToken);
    const destPrice = await this.getTokenPriceUsd(destToken);

    // Skip quote if either token doesn't have a price
    if (!originPrice || !destPrice) {
      this.logger.warn(
        `⏭️ Skipping quote: Price not found for ${originToken} (${originPrice ? '✓' : '✗'}) or ${destToken} (${destPrice ? '✓' : '✗'})`,
      );
      return null;
    }

    // Get decimals
    const originDecimals = this.getTokenDecimals(originToken);
    const destDecimals = this.getTokenDecimals(destToken);

    // Convert amount to human-readable
    const amountIn = parseFloat(amount) / Math.pow(10, originDecimals);

    // Calculate USD value
    const usdValue = amountIn * originPrice;

    // Apply markup (reduce output)
    const usdValueAfterMarkup = usdValue * (1 - this.markupPct);

    // Convert to destination token
    const amountOutHuman = usdValueAfterMarkup / destPrice;

    // Convert back to raw amount
    const amountOut = Math.floor(
      amountOutHuman * Math.pow(10, destDecimals),
    ).toString();

    const rate = destPrice / originPrice;

    this.logger.log(
      `Quote: ${amountIn} ${originToken} ($${usdValue.toFixed(2)}) -> ${amountOutHuman.toFixed(6)} ${destToken} (rate: ${rate.toFixed(6)}, markup: ${this.markupPct * 100}%)`,
    );

    return { amountOut, rate };
  }

  /**
   * Extract token address from defuse asset identifier
   * Examples:
   * - nep141:usdt.tether-token.near -> usdt.tether-token.near
   * - nep141:eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near -> eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near
   * - nep245:v2_1.omni.hot.tg:56_11111111111111111111 -> 56_11111111111111111111
   */
  private extractTokenAddress(defuseIdentifier: string): string {
    const parts = defuseIdentifier.split(':');

    if (parts[0] === 'nep141') {
      return parts[1]; // Return full token address
    }

    if (parts[0] === 'nep245') {
      // Format: nep245:v2_1.omni.hot.tg:chainId_tokenAddress
      const chainToken = parts[2];
      const [chainId, tokenAddress] = chainToken.split('_');

      // Return the raw token address or 'native' for native tokens
      if (tokenAddress === '11111111111111111111') {
        return 'native'; // Native token (BNB, AVAX, etc)
      }

      return tokenAddress;
    }

    // Default: return last part
    return parts[parts.length - 1];
  }

  /**
   * Get token decimals
   */
  private getTokenDecimals(tokenAddress: string): number {
    return this.decimals[tokenAddress] || 18; // Default to 18
  }

  /**
   * Add token mapping for Binance API
   */
  addTokenMapping(tokenAddress: string, chainId: string, contractAddress: string): void {
    this.tokenMapping[tokenAddress] = { chainId, address: contractAddress };
    this.logger.log(`Added token mapping: ${tokenAddress} -> chainId=${chainId}, address=${contractAddress}`);
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
    this.logger.log('Price cache cleared');
  }

  /**
   * Get cached prices
   */
  getCachedPrices(): Record<string, number> {
    const prices: Record<string, number> = {};
    this.priceCache.forEach((value, key) => {
      prices[key] = value.price;
    });
    return prices;
  }
}
