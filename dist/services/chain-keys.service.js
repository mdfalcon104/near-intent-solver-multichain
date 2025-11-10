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
Object.defineProperty(exports, "__esModule", { value: true });
exports.ChainKeysService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const ethers_1 = require("ethers");
const nearAPI = __importStar(require("near-api-js"));
let ChainKeysService = class ChainKeysService {
    constructor(config) {
        this.config = config;
        this.chainConfigs = new Map();
        this.loadChainConfigs();
    }
    loadChainConfigs() {
        const chains = [
            'NEAR',
            'ETHEREUM',
            'ARBITRUM',
            'POLYGON',
            'AVALANCHE',
            'BSC',
            'OPTIMISM',
            'BASE',
            'SOLANA',
            'BITCOIN',
            'AURORA'
        ];
        for (const chain of chains) {
            const privateKey = this.config.get(`CHAIN_${chain}_PRIVATE_KEY`);
            if (privateKey) {
                const chainConfig = {
                    chainId: chain.toLowerCase(),
                    privateKey,
                    rpcUrl: this.config.get(`CHAIN_${chain}_RPC_URL`),
                    networkId: this.config.get(`CHAIN_${chain}_NETWORK_ID`),
                };
                this.chainConfigs.set(chain.toLowerCase(), chainConfig);
            }
        }
    }
    getChainConfig(chainId) {
        return this.chainConfigs.get(chainId.toLowerCase());
    }
    isChainSupported(chainId) {
        return this.chainConfigs.has(chainId.toLowerCase());
    }
    getSupportedChains() {
        return Array.from(this.chainConfigs.keys());
    }
    getEvmSigner(chainId) {
        const config = this.getChainConfig(chainId);
        if (!config || !config.privateKey) {
            return null;
        }
        try {
            const wallet = new ethers_1.ethers.Wallet(config.privateKey);
            if (config.rpcUrl) {
                const provider = new ethers_1.ethers.JsonRpcProvider(config.rpcUrl);
                return wallet.connect(provider);
            }
            return wallet;
        }
        catch (error) {
            console.error(`Failed to create EVM signer for ${chainId}:`, error);
            return null;
        }
    }
    async getNearAccount(accountId) {
        const config = this.getChainConfig('near');
        if (!config || !config.privateKey) {
            return null;
        }
        try {
            const networkId = config.networkId || 'testnet';
            const keyPair = nearAPI.utils.KeyPair.fromString(config.privateKey);
            const connectionConfig = {
                networkId,
                keyStore: new nearAPI.keyStores.InMemoryKeyStore(),
                nodeUrl: config.rpcUrl || `https://rpc.${networkId}.near.org`,
                walletUrl: `https://wallet.${networkId}.near.org`,
                helperUrl: `https://helper.${networkId}.near.org`,
            };
            const near = await nearAPI.connect(connectionConfig);
            const actualAccountId = accountId || config.networkId || 'solver.testnet';
            await connectionConfig.keyStore.setKey(networkId, actualAccountId, keyPair);
            return await near.account(actualAccountId);
        }
        catch (error) {
            console.error('Failed to create NEAR account:', error);
            return null;
        }
    }
    getAddress(chainId) {
        const config = this.getChainConfig(chainId);
        if (!config || !config.privateKey) {
            return null;
        }
        const lowerChainId = chainId.toLowerCase();
        if (['ethereum', 'arbitrum', 'polygon', 'avalanche', 'bsc', 'optimism', 'base', 'aurora'].includes(lowerChainId)) {
            try {
                const wallet = new ethers_1.ethers.Wallet(config.privateKey);
                return wallet.address;
            }
            catch (error) {
                console.error(`Failed to derive EVM address for ${chainId}:`, error);
                return null;
            }
        }
        if (lowerChainId === 'near') {
            try {
                const keyPair = nearAPI.utils.KeyPair.fromString(config.privateKey);
                return keyPair.getPublicKey().toString();
            }
            catch (error) {
                console.error('Failed to derive NEAR public key:', error);
                return null;
            }
        }
        return null;
    }
    async signTransaction(chainId, transaction) {
        const signer = this.getEvmSigner(chainId);
        if (!signer) {
            return null;
        }
        try {
            const signedTx = await signer.signTransaction(transaction);
            return signedTx;
        }
        catch (error) {
            console.error(`Failed to sign transaction for ${chainId}:`, error);
            return null;
        }
    }
};
exports.ChainKeysService = ChainKeysService;
exports.ChainKeysService = ChainKeysService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService])
], ChainKeysService);
//# sourceMappingURL=chain-keys.service.js.map