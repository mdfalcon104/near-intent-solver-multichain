"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SimplePricingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SimplePricingService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const inventory_service_1 = require("./inventory.service");
const axios_1 = __importDefault(require("axios"));
let SimplePricingService = SimplePricingService_1 = class SimplePricingService {
    constructor(configService, inventoryService) {
        this.configService = configService;
        this.inventoryService = inventoryService;
        this.logger = new common_1.Logger(SimplePricingService_1.name);
        this.priceCache = new Map();
        this.cacheTTL = 60000;
        this.fallbackPrices = {
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
            'native': 600.0,
        };
        this.chainIdMap = {
            ethereum: '1',
            arbitrum: '42161',
            polygon: '137',
            bsc: '56',
            avalanche: '43114',
            bitcoin: 'bitcoin',
            near: 'near',
            solana: 'solana',
        };
        this.tokenMapping = {
            'usdt.tether-token.near': { chainId: '56', address: '0x55d398326f99059ff775485246999027b3197955' },
            'usdc.tether-token.near': { chainId: '56', address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d' },
            'wrap.near': { chainId: 'near', address: 'near' },
            'btc.omft.near': { chainId: 'bitcoin', address: 'bitcoin' },
            'eth-0xdac17f958d2ee523a2206206994597c13d831ec7.omft.near': { chainId: '1', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
            'eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near': { chainId: '1', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
            'eth.omft.near': { chainId: '1', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
            '0xdac17f958d2ee523a2206206994597c13d831ec7': { chainId: '1', address: '0xdac17f958d2ee523a2206206994597c13d831ec7' },
            '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': { chainId: '1', address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48' },
            '0xaf88d065e77c8cc2239327c5edb3a432268e5831': { chainId: '42161', address: '0xaf88d065e77c8cc2239327c5edb3a432268e5831' },
            '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9': { chainId: '42161', address: '0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9' },
            'native': { chainId: '56', address: '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee' },
        };
        this.decimals = {
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
        this.markupPct = parseFloat(this.configService.get('MARKUP_PCT') || '0.005');
        this.logger.log(`Initialized with ${this.markupPct * 100}% markup, using OKX (backup) + fallback for pricing`);
    }
    async onModuleInit() {
        try {
            await this.loadTokenMappingsFromInventory();
            this.logger.log('✅ Token mappings loaded from inventory');
        }
        catch (error) {
            this.logger.warn(`⚠️ Failed to load token mappings from inventory: ${error.message}`);
        }
    }
    async loadTokenMappingsFromInventory() {
        const config = this.inventoryService.getRawConfig();
        if (!config || !config.chains) {
            this.logger.warn('No chains found in inventory');
            return;
        }
        let mappingsAdded = 0;
        for (const [chainName, chainConfig] of Object.entries(config.chains)) {
            const typed = chainConfig;
            if (!typed || !typed.tokens)
                continue;
            for (const token of typed.tokens) {
                if (!token.address_price || !token.chainId_price) {
                    continue;
                }
                this.tokenMapping[token.address] = {
                    chainId: token.chainId_price,
                    address: token.address_price,
                };
                if (!this.fallbackPrices[token.address]) {
                    const symbol = (token.symbol || '').toUpperCase();
                    if (symbol.includes('USDT') || symbol.includes('USDC')) {
                        this.fallbackPrices[token.address] = 1.0;
                    }
                    else if (symbol.includes('ETH') || symbol.includes('WETH')) {
                        this.fallbackPrices[token.address] = 3500.0;
                    }
                    else if (symbol.includes('BTC')) {
                        this.fallbackPrices[token.address] = 98000.0;
                    }
                    else if (symbol.includes('NEAR') || symbol.includes('WNEAR')) {
                        this.fallbackPrices[token.address] = 5.0;
                    }
                    else {
                        this.fallbackPrices[token.address] = 0.01;
                    }
                }
                this.logger.debug(`Registered price mapping for ${token.symbol} (${token.address}): chainId=${token.chainId_price}, address=${token.address_price}`);
                mappingsAdded++;
            }
        }
        this.logger.log(`✅ Loaded ${mappingsAdded} token price mappings from inventory`);
    }
    async reloadTokenMappings() {
        this.logger.log('Reloading token mappings from inventory...');
        await this.loadTokenMappingsFromInventory();
    }
    async fetchPriceFromBinance(chainId, contractAddress) {
        try {
            const url = `https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/token/price/info?chainId=${chainId}&contractAddress=${contractAddress}`;
            this.logger.debug(`Fetching price from Binance: chainId=${chainId}, address=${contractAddress}`);
            const response = await axios_1.default.get(url, {
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
        }
        catch (error) {
            this.logger.debug(`Binance API failed: ${error.message}`);
            return null;
        }
    }
    async fetchPriceFromOkx(chainId, contractAddress) {
        try {
            const now = Date.now();
            const after = now;
            const url = `https://web3.okx.com/priapi/v5/dex/token/market/dex-token-hlc-candles?chainId=${chainId}&address=${contractAddress}&after=${after}&bar=1m&limit=1`;
            this.logger.debug(`Fetching price from OKX: chainId=${chainId}, address=${contractAddress}`);
            const response = await axios_1.default.get(url, {
                timeout: 3000,
                headers: {
                    'User-Agent': 'Mozilla/5.0',
                    'Accept': 'application/json',
                },
            });
            if (response.data?.code === "0" && response.data?.data && response.data.data.length > 0) {
                const firstCandle = response.data.data[0];
                if (firstCandle && firstCandle.length >= 5) {
                    const closePrice = parseFloat(firstCandle[4]);
                    if (closePrice > 0) {
                        this.logger.debug(`OKX price for ${contractAddress} on chain ${chainId}: $${closePrice}`);
                        return closePrice;
                    }
                }
            }
            this.logger.warn(`No price data from OKX for ${contractAddress} on chain ${chainId}`);
            return null;
        }
        catch (error) {
            this.logger.debug(`OKX API failed: ${error.message}`);
            return null;
        }
    }
    async getTokenPriceUsd(tokenAddress) {
        const cacheKey = tokenAddress;
        const cached = this.priceCache.get(cacheKey);
        if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
            this.logger.debug(`Using cached price for ${tokenAddress}: $${cached.price}`);
            return cached.price;
        }
        const mapping = this.tokenMapping[tokenAddress];
        if (mapping) {
            let price = await this.fetchPriceFromBinance(mapping.chainId, mapping.address);
            if (price !== null && price > 0) {
                this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
                this.logger.log(`✅ Binance price for ${tokenAddress}: $${price}`);
                return price;
            }
            price = await this.fetchPriceFromOkx(mapping.chainId, mapping.address);
            if (price !== null && price > 0) {
                this.priceCache.set(cacheKey, { price, timestamp: Date.now() });
                this.logger.log(`✅ OKX price for ${tokenAddress}: $${price}`);
                return price;
            }
        }
        const fallbackPrice = this.fallbackPrices[tokenAddress];
        if (fallbackPrice) {
            this.logger.log(`⚠️ Using fallback price for ${tokenAddress}: $${fallbackPrice}`);
            this.priceCache.set(cacheKey, { price: fallbackPrice, timestamp: Date.now() });
            return fallbackPrice;
        }
        this.logger.warn(`❌ No price found for token: ${tokenAddress}`);
        return null;
    }
    async calculateQuote(params) {
        const { originAsset, destinationAsset, amount } = params;
        const originToken = this.extractTokenAddress(originAsset);
        const destToken = this.extractTokenAddress(destinationAsset);
        this.logger.debug(`Calculating quote: ${originToken} -> ${destToken}, amount: ${amount}`);
        const originPrice = await this.getTokenPriceUsd(originToken);
        const destPrice = await this.getTokenPriceUsd(destToken);
        if (!originPrice || !destPrice) {
            this.logger.warn(`⏭️ Skipping quote: Price not found for ${originToken} (${originPrice ? '✓' : '✗'}) or ${destToken} (${destPrice ? '✓' : '✗'})`);
            return null;
        }
        const originDecimals = this.getTokenDecimals(originToken);
        const destDecimals = this.getTokenDecimals(destToken);
        const amountIn = parseFloat(amount) / Math.pow(10, originDecimals);
        const usdValue = amountIn * originPrice;
        const usdValueAfterMarkup = usdValue * (1 - this.markupPct);
        const amountOutHuman = usdValueAfterMarkup / destPrice;
        const amountOut = Math.floor(amountOutHuman * Math.pow(10, destDecimals)).toString();
        const rate = destPrice / originPrice;
        this.logger.log(`Quote: ${amountIn} ${originToken} ($${usdValue.toFixed(2)}) -> ${amountOutHuman.toFixed(6)} ${destToken} (rate: ${rate.toFixed(6)}, markup: ${this.markupPct * 100}%)`);
        return { amountOut, rate };
    }
    extractTokenAddress(defuseIdentifier) {
        const parts = defuseIdentifier.split(':');
        if (parts[0] === 'nep141') {
            return parts[1];
        }
        if (parts[0] === 'nep245') {
            const chainToken = parts[2];
            const [chainId, tokenAddress] = chainToken.split('_');
            if (tokenAddress === '11111111111111111111') {
                return 'native';
            }
            return tokenAddress;
        }
        return parts[parts.length - 1];
    }
    getTokenDecimals(tokenAddress) {
        return this.decimals[tokenAddress] || 18;
    }
    addTokenMapping(tokenAddress, chainId, contractAddress) {
        this.tokenMapping[tokenAddress] = { chainId, address: contractAddress };
        this.logger.log(`Added token mapping: ${tokenAddress} -> chainId=${chainId}, address=${contractAddress}`);
    }
    clearCache() {
        this.priceCache.clear();
        this.logger.log('Price cache cleared');
    }
    getCachedPrices() {
        const prices = {};
        this.priceCache.forEach((value, key) => {
            prices[key] = value.price;
        });
        return prices;
    }
};
exports.SimplePricingService = SimplePricingService;
exports.SimplePricingService = SimplePricingService = SimplePricingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        inventory_service_1.InventoryService])
], SimplePricingService);
//# sourceMappingURL=simple-pricing.service.js.map