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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var Nep413SignerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.Nep413SignerService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const borsher_1 = require("borsher");
const bs58_1 = __importDefault(require("bs58"));
const crypto = __importStar(require("crypto"));
const near_api_js_1 = require("near-api-js");
const chain_keys_service_1 = require("./chain-keys.service");
const standardNumber = {
    nep413: 413,
};
const Nep413PayloadSchema = borsher_1.BorshSchema.Struct({
    message: borsher_1.BorshSchema.String,
    nonce: borsher_1.BorshSchema.Array(borsher_1.BorshSchema.u8, 32),
    recipient: borsher_1.BorshSchema.String,
    callback_url: borsher_1.BorshSchema.Option(borsher_1.BorshSchema.String),
});
let Nep413SignerService = Nep413SignerService_1 = class Nep413SignerService {
    constructor(configService, chainKeysService) {
        this.configService = configService;
        this.chainKeysService = chainKeysService;
        this.logger = new common_1.Logger(Nep413SignerService_1.name);
        this.usedNonces = new Set();
        this.defuseContract =
            this.configService.get('DEFUSE_CONTRACT') || 'intents.near';
        this.nearAccountId = this.configService.get('NEAR_ACCOUNT_ID');
        if (!this.nearAccountId) {
            this.logger.warn('NEAR_ACCOUNT_ID not configured. NEP-413 signing will not work.');
        }
        const nearPrivateKey = this.configService.get('CHAIN_NEAR_PRIVATE_KEY');
        if (nearPrivateKey) {
            try {
                this.nearKeyPair = near_api_js_1.KeyPair.fromString(nearPrivateKey);
                this.logger.log(`Initialized NEP-413 signer for account: ${this.nearAccountId}`);
            }
            catch (error) {
                this.logger.error('Failed to parse NEAR private key', error);
            }
        }
    }
    async generateNonce() {
        const randomArray = crypto.randomBytes(32);
        const nonceString = randomArray.toString('base64');
        if (this.usedNonces.has(nonceString)) {
            return this.generateNonce();
        }
        this.usedNonces.add(nonceString);
        return nonceString;
    }
    base64ToUint8Array(base64) {
        const binaryString = Buffer.from(base64, 'base64').toString('binary');
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes;
    }
    serializeIntent(intentMessage, recipient, nonce, standard) {
        const nonceArray = Array.from(this.base64ToUint8Array(nonce));
        const payload = {
            message: intentMessage,
            nonce: nonceArray,
            recipient,
            callback_url: null,
        };
        const payloadSerialized = (0, borsher_1.borshSerialize)(Nep413PayloadSchema, payload);
        const baseInt = 2 ** 31 + standardNumber[standard];
        const baseIntSerialized = (0, borsher_1.borshSerialize)(borsher_1.BorshSchema.u32, baseInt);
        const combinedData = Buffer.concat([baseIntSerialized, payloadSerialized]);
        return crypto.createHash('sha256').update(combinedData).digest();
    }
    async signMessage(message) {
        if (!this.nearKeyPair) {
            throw new Error('NEAR KeyPair not initialized');
        }
        const sig = this.nearKeyPair.sign(message);
        return {
            signature: sig.signature,
            publicKey: this.nearKeyPair.getPublicKey().data,
        };
    }
    async createSignedQuote(quoteId, params, calculatedAmount) {
        if (!this.nearAccountId || !this.nearKeyPair) {
            throw new Error('NEAR account not configured for signing');
        }
        const standard = 'nep413';
        const deadlineTimestamp = Math.floor((Date.now() + params.min_deadline_ms) / 1000);
        const message = {
            signer_id: this.nearAccountId,
            deadline: {
                timestamp: deadlineTimestamp,
            },
            intents: [
                {
                    intent: 'token_diff',
                    diff: {
                        [params.defuse_asset_identifier_in]: params.exact_amount_in
                            ? params.exact_amount_in
                            : calculatedAmount,
                        [params.defuse_asset_identifier_out]: `-${params.exact_amount_out ? params.exact_amount_out : calculatedAmount}`,
                    },
                },
            ],
        };
        const messageStr = JSON.stringify(message);
        const nonce = await this.generateNonce();
        const recipient = this.defuseContract;
        const quoteHash = this.serializeIntent(messageStr, recipient, nonce, standard);
        const signature = await this.signMessage(quoteHash);
        const resp = {
            quote_id: quoteId,
            quote_output: {},
            signed_data: {
                standard,
                payload: {
                    message: messageStr,
                    nonce,
                    recipient,
                },
                signature: `ed25519:${bs58_1.default.encode(signature.signature)}`,
                public_key: `ed25519:${bs58_1.default.encode(signature.publicKey)}`,
            },
        };
        if (!params.exact_amount_in) {
            resp.quote_output.amount_in = calculatedAmount;
        }
        else {
            resp.quote_output.amount_out = calculatedAmount;
        }
        this.logger.log(`Created signed quote ${quoteId} for ${calculatedAmount} tokens`);
        return resp;
    }
};
exports.Nep413SignerService = Nep413SignerService;
exports.Nep413SignerService = Nep413SignerService = Nep413SignerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        chain_keys_service_1.ChainKeysService])
], Nep413SignerService);
//# sourceMappingURL=nep413-signer.service.js.map