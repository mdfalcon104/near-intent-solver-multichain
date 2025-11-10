import { ConfigService } from '../config/config.service';
export declare class InventoryService {
    private readonly configService;
    private readonly logger;
    private inventory;
    private configPath;
    constructor(configService: ConfigService);
    private loadInventoryConfig;
    private formatBalance;
    canProvideQuote(originAsset: string, destinationAsset: string, amountOut: string): boolean;
    reserveInventory(quoteId: string, destinationAsset: string, amount: string): boolean;
    releaseInventory(quoteId: string, destinationAsset: string, amount: string): void;
    private parseAssetIdentifier;
    getInventorySummary(): any;
    reloadInventory(): void;
    updateBalance(chain: string, token: string, newBalance: string): void;
}
