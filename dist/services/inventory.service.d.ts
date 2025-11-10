import { ConfigService } from '../config/config.service';
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
export declare class InventoryService {
    private readonly configService;
    private readonly logger;
    private inventory;
    private configPath;
    private rawConfig;
    constructor(configService: ConfigService);
    private loadInventoryConfig;
    private formatBalance;
    canProvideQuote(originAsset: string, destinationAsset: string, amountOut: string): boolean;
    reserveInventory(quoteId: string, destinationAsset: string, amount: string): boolean;
    releaseInventory(quoteId: string, destinationAsset: string, amount: string): void;
    private parseAssetIdentifier;
    getInventorySummary(): any;
    reloadInventory(): void;
    getRawConfig(): InventoryConfig | null;
    updateBalance(chain: string, token: string, newBalance: string): void;
}
export {};
