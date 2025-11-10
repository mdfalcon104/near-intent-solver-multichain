import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { InventoryService } from './inventory.service';
export declare class SimplePricingService implements OnModuleInit {
    private readonly configService;
    private readonly inventoryService;
    private readonly logger;
    private readonly markupPct;
    private readonly priceCache;
    private readonly cacheTTL;
    private readonly fallbackPrices;
    private readonly chainIdMap;
    private readonly tokenMapping;
    private readonly decimals;
    constructor(configService: ConfigService, inventoryService: InventoryService);
    onModuleInit(): Promise<void>;
    private loadTokenMappingsFromInventory;
    reloadTokenMappings(): Promise<void>;
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
