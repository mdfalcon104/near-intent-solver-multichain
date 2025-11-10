"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var InventoryService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.InventoryService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const near_service_1 = require("./near.service");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
let InventoryService = InventoryService_1 = class InventoryService {
    constructor(configService, near) {
        this.configService = configService;
        this.near = near;
        this.logger = new common_1.Logger(InventoryService_1.name);
        this.inventory = new Map();
        this.rawConfig = null;
        this.INTENTS_CONTRACT = 'intents.near';
        this.configPath = this.configService.get('INVENTORY_CONFIG_PATH') || './inventory.json';
        this.loadInventoryConfig().catch((error) => {
            this.logger.error(`Error loading inventory config: ${error.message}`);
        });
    }
    async loadInventoryConfig() {
        try {
            const fullPath = path.resolve(process.cwd(), this.configPath);
            if (!fs.existsSync(fullPath)) {
                this.logger.warn(`Inventory config not found at ${fullPath}, using empty inventory`);
                return;
            }
            const configData = fs.readFileSync(fullPath, 'utf-8');
            this.rawConfig = JSON.parse(configData);
            this.logger.log(`Loading inventory from ${fullPath}`);
            for (const [chain, chainConfig] of Object.entries(this.rawConfig.chains)) {
                const tokens = new Map();
                if (chainConfig.enabled && chainConfig.tokens) {
                    for (const tokenConfig of chainConfig.tokens) {
                        let currentBalance = tokenConfig.currentBalance;
                        if (tokenConfig.enabled) {
                            try {
                                const contractBalance = await this.fetchTokenBalanceFromContract(tokenConfig.address);
                                currentBalance = contractBalance;
                                this.logger.log(`[Balance] Updated ${tokenConfig.symbol} on ${chain} from contract: ${this.formatBalance(currentBalance, tokenConfig.decimals)}`);
                            }
                            catch (balanceError) {
                                this.logger.warn(`[Balance] Failed to fetch ${tokenConfig.symbol} from contract, using default: ${this.formatBalance(tokenConfig.currentBalance, tokenConfig.decimals)}`);
                            }
                        }
                        tokens.set(tokenConfig.address.toLowerCase(), {
                            address: tokenConfig.address,
                            symbol: tokenConfig.symbol,
                            decimals: tokenConfig.decimals,
                            balance: currentBalance,
                            minBalance: tokenConfig.minBalance,
                            enabled: tokenConfig.enabled,
                        });
                    }
                }
                this.inventory.set(chain.toLowerCase(), {
                    chain,
                    enabled: chainConfig.enabled,
                    tokens,
                });
                if (chainConfig.enabled && tokens.size > 0) {
                    const enabledTokens = Array.from(tokens.values()).filter(t => t.enabled);
                    this.logger.log(`${chain}: ${enabledTokens.length} enabled tokens`);
                    enabledTokens.forEach((token) => {
                        this.logger.log(`  - ${token.symbol} (${token.address}): ${this.formatBalance(token.balance, token.decimals)} (min: ${this.formatBalance(token.minBalance, token.decimals)})`);
                    });
                }
            }
            this.logger.log(`Inventory loaded successfully`);
        }
        catch (error) {
            this.logger.error(`Failed to load inventory config: ${error.message}`);
        }
    }
    formatBalance(balance, decimals) {
        const num = BigInt(balance);
        const divisor = BigInt(10 ** decimals);
        const whole = num / divisor;
        return whole.toString();
    }
    canProvideQuote(originAsset, destinationAsset, amountOut) {
        const { chain, token } = this.parseAssetIdentifier(destinationAsset);
        const chainInventory = this.inventory.get(chain);
        if (!chainInventory?.enabled) {
            this.logger.debug(`Chain ${chain} not enabled in inventory`);
            return false;
        }
        const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
        if (!tokenInventory?.enabled) {
            this.logger.debug(`Token ${token} not enabled on ${chain}`);
            return false;
        }
        const amountOutBigInt = BigInt(Math.floor(Number(amountOut)));
        const hasEnoughBalance = BigInt(tokenInventory.balance) >= amountOutBigInt;
        if (!hasEnoughBalance) {
            this.logger.warn(`Insufficient inventory: ${token} on ${chain}. Have: ${tokenInventory.balance}, Need: ${amountOut}`);
            return false;
        }
        const remainingAfter = BigInt(tokenInventory.balance) - amountOutBigInt;
        const meetsMinimum = remainingAfter >= BigInt(tokenInventory.minBalance);
        if (!meetsMinimum) {
            this.logger.warn(`Would fall below minimum balance: ${token} on ${chain}. Min: ${tokenInventory.minBalance}, Would have: ${remainingAfter}`);
            return false;
        }
        return true;
    }
    reserveInventory(quoteId, destinationAsset, amount) {
        const { chain, token } = this.parseAssetIdentifier(destinationAsset);
        const chainInventory = this.inventory.get(chain);
        if (!chainInventory) {
            return false;
        }
        const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
        if (!tokenInventory) {
            return false;
        }
        const newBalance = BigInt(tokenInventory.balance) - BigInt(amount);
        tokenInventory.balance = newBalance.toString();
        this.logger.log(`Reserved ${amount} ${token} on ${chain} for quote ${quoteId}. New balance: ${tokenInventory.balance}`);
        return true;
    }
    releaseInventory(quoteId, destinationAsset, amount) {
        const { chain, token } = this.parseAssetIdentifier(destinationAsset);
        const chainInventory = this.inventory.get(chain);
        if (!chainInventory) {
            return;
        }
        const tokenInventory = chainInventory.tokens.get(token.toLowerCase());
        if (!tokenInventory) {
            return;
        }
        const newBalance = BigInt(tokenInventory.balance) + BigInt(amount);
        tokenInventory.balance = newBalance.toString();
        this.logger.log(`Released ${amount} ${token} on ${chain} for quote ${quoteId}. New balance: ${tokenInventory.balance}`);
    }
    parseAssetIdentifier(assetId) {
        const withoutPrefix = assetId.replace(/^nep141:/, '');
        if (!withoutPrefix.includes('-')) {
            return {
                chain: 'near',
                token: withoutPrefix,
            };
        }
        const parts = withoutPrefix.split('-');
        if (parts.length < 2) {
            throw new Error(`Invalid asset identifier: ${assetId}`);
        }
        const chainPrefix = parts[0];
        const tokenAddress = parts.slice(1).join('-').replace('.omft.near', '');
        const chainMap = {
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
    getInventorySummary() {
        const summary = {};
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
    reloadInventory() {
        this.logger.log('Reloading inventory configuration...');
        this.inventory.clear();
        this.rawConfig = null;
        this.loadInventoryConfig();
    }
    getRawConfig() {
        return this.rawConfig;
    }
    updateBalance(chain, token, newBalance) {
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
    async fetchTokenBalanceFromContract(tokenId, accountId) {
        const account = accountId || this.configService.get('NEAR_ACCOUNT_ID');
        this.logger.log(`[TokenBalance] Fetching balance from intents contract...`);
        this.logger.log(`  Contract: ${this.INTENTS_CONTRACT}`);
        this.logger.log(`  Token: ${tokenId}`);
        this.logger.log(`  Account: ${account}`);
        try {
            const response = await this.near.viewFunction(this.INTENTS_CONTRACT, 'mt_balance_of', {
                account_id: account,
                token_id: tokenId,
            });
            const balance = typeof response === 'string'
                ? response
                : Buffer.isBuffer(response)
                    ? Buffer.from(response).toString()
                    : JSON.stringify(response);
            this.logger.log(`[TokenBalance] Balance fetched`);
            this.logger.log(`  Balance: ${balance}`);
            return balance;
        }
        catch (error) {
            this.logger.error(`[TokenBalance] Failed to fetch balance: ${error}`);
            throw error;
        }
    }
    async syncTokenBalance(chain, token, tokenId) {
        this.logger.log(`[Sync] Syncing token balance...`);
        this.logger.log(`  Chain: ${chain}`);
        this.logger.log(`  Token: ${token}`);
        this.logger.log(`  TokenId: ${tokenId}`);
        try {
            const liveBalance = await this.fetchTokenBalanceFromContract(tokenId);
            this.updateBalance(chain, token, liveBalance);
            this.logger.log(`[Sync] Balance synced`);
            this.logger.log(`  Chain: ${chain}`);
            this.logger.log(`  Token: ${token}`);
            this.logger.log(`  New Balance: ${liveBalance}`);
            return liveBalance;
        }
        catch (error) {
            this.logger.error(`[Sync] Failed to sync balance: ${error}`);
            throw error;
        }
    }
    async syncAllTokenBalances() {
        this.logger.log(`[SyncAll] Starting full inventory sync...`);
        const syncResults = {};
        try {
            for (const [chain, chainInventory] of this.inventory.entries()) {
                if (!chainInventory.enabled) {
                    continue;
                }
                syncResults[chain] = {};
                for (const [tokenAddress, tokenInventory] of chainInventory.tokens) {
                    if (!tokenInventory.enabled) {
                        continue;
                    }
                    try {
                        const tokenId = `nep141:${tokenInventory.address}`;
                        const liveBalance = await this.fetchTokenBalanceFromContract(tokenId);
                        tokenInventory.balance = liveBalance;
                        syncResults[chain][tokenInventory.symbol] = liveBalance;
                        this.logger.log(`[SyncAll] ${tokenInventory.symbol} on ${chain}: ${liveBalance}`);
                    }
                    catch (error) {
                        this.logger.warn(`[SyncAll] Failed to sync ${tokenInventory.symbol} on ${chain}: ${error}`);
                        syncResults[chain][tokenInventory.symbol] = 'ERROR';
                    }
                }
            }
            this.logger.log(`[SyncAll] Full sync completed`);
            return syncResults;
        }
        catch (error) {
            this.logger.error(`[SyncAll] Full sync failed: ${error}`);
            throw error;
        }
    }
};
exports.InventoryService = InventoryService;
exports.InventoryService = InventoryService = InventoryService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        near_service_1.NearService])
], InventoryService);
//# sourceMappingURL=inventory.service.js.map