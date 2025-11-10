import { ConfigService } from '../config/config.service';
export declare class SimplePricingService {
    private readonly configService;
    private readonly logger;
    private readonly markupPct;
    private readonly priceCache;
    private readonly cacheTTL;
    private readonly fallbackPrices;
    private readonly chainIdMap;
    private readonly tokenMapping;
    private readonly decimals;
    constructor(configService: ConfigService);
    private fetchPriceFromBinance;
    private fetchPriceFromOkx;
    private getTokenPriceUsd;
    calculateQuote(params: {
        originAsset: string;
        destinationAsset: string;
        amount: string;
    }): Promise<{
        amountOut: string;
        rate: number;
    }>;
    private extractTokenAddress;
    private getTokenDecimals;
    addTokenMapping(tokenAddress: string, chainId: string, contractAddress: string): void;
    clearCache(): void;
    getCachedPrices(): Record<string, number>;
}
