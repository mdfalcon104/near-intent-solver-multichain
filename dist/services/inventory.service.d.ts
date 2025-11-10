import { ConfigService } from '../config/config.service';
import { NearService } from './near.service';
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
    private readonly near;
    private readonly logger;
    private inventory;
    private configPath;
    private rawConfig;
    private readonly INTENTS_CONTRACT;
    constructor(configService: ConfigService, near: NearService);
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
    fetchTokenBalanceFromContract(tokenId: string, accountId?: string): Promise<string>;
    syncTokenBalance(chain: string, token: string, tokenId: string): Promise<string>;
    syncAllTokenBalances(): Promise<Record<string, Record<string, string>>>;
}
export {};
