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
Object.defineProperty(exports, "__esModule", { value: true });
exports.OneClickService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const chain_keys_service_1 = require("./chain-keys.service");
const ethers_1 = require("ethers");
const axios_1 = __importDefault(require("axios"));
let OneClickService = class OneClickService {
    constructor(config, chainKeys) {
        this.config = config;
        this.chainKeys = chainKeys;
        this.baseUrl = 'https://1click.chaindefuser.com';
        this.apiVersion = 'v0';
        this.jwtToken = this.config.get('ONECLICK_JWT_TOKEN', '');
    }
    getHeaders() {
        const headers = {
            'Content-Type': 'application/json',
        };
        if (this.jwtToken) {
            headers['Authorization'] = `Bearer ${this.jwtToken}`;
        }
        return headers;
    }
    async getSupportedTokens() {
        try {
            const response = await axios_1.default.get(`${this.baseUrl}/${this.apiVersion}/tokens`, { headers: this.getHeaders() });
            return response.data;
        }
        catch (error) {
            console.error('Failed to get supported tokens:', error);
            throw error;
        }
    }
    async requestQuote(request) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/${this.apiVersion}/quote`, request, { headers: this.getHeaders() });
            return response.data;
        }
        catch (error) {
            console.error('Failed to request quote:', error);
            throw error;
        }
    }
    async submitDepositTx(params) {
        try {
            const response = await axios_1.default.post(`${this.baseUrl}/${this.apiVersion}/deposit/submit`, params, { headers: this.getHeaders() });
            return response.data;
        }
        catch (error) {
            console.error('Failed to submit deposit tx:', error);
            throw error;
        }
    }
    async getSwapStatus(depositAddress, depositMemo) {
        try {
            const params = { depositAddress };
            if (depositMemo) {
                params.depositMemo = depositMemo;
            }
            const response = await axios_1.default.get(`${this.baseUrl}/${this.apiVersion}/status`, {
                headers: this.getHeaders(),
                params,
            });
            return response.data;
        }
        catch (error) {
            console.error('Failed to get swap status:', error);
            throw error;
        }
    }
    async executeCrossChainSwap(params) {
        const { originChain, originAsset, destinationChain, destinationAsset, amount, recipient, refundTo, slippageTolerance = 100, swapType = 'EXACT_INPUT', } = params;
        const deadline = new Date(Date.now() + 3600000).toISOString();
        const quoteRequest = {
            dry: false,
            swapType,
            slippageTolerance,
            originAsset,
            depositType: 'ORIGIN_CHAIN',
            destinationAsset,
            amount,
            refundTo: refundTo || recipient,
            refundType: 'ORIGIN_CHAIN',
            recipient,
            recipientType: 'DESTINATION_CHAIN',
            deadline,
            quoteWaitingTimeMs: 3000,
        };
        const quote = await this.requestQuote(quoteRequest);
        let depositTxHash;
        const signer = this.chainKeys.getEvmSigner(originChain);
        if (!signer) {
            throw new Error(`No signer configured for chain: ${originChain}`);
        }
        const tx = await signer.sendTransaction({
            to: quote.quote.depositAddress,
            value: ethers_1.ethers.parseUnits(amount, 18),
        });
        await tx.wait();
        depositTxHash = tx.hash;
        const status = await this.submitDepositTx({
            txHash: depositTxHash,
            depositAddress: quote.quote.depositAddress,
            memo: quote.quote.depositMemo,
        });
        return {
            quote,
            depositTxHash,
            status,
        };
    }
    async monitorSwap(depositAddress, depositMemo, maxWaitTime = 300000, pollInterval = 5000) {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWaitTime) {
            const status = await this.getSwapStatus(depositAddress, depositMemo);
            if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(status.status)) {
                return status;
            }
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }
        throw new Error('Swap monitoring timeout');
    }
    async getQuoteEstimate(params) {
        const { originAsset, destinationAsset, amount, slippageTolerance = 100 } = params;
        const deadline = new Date(Date.now() + 3600000).toISOString();
        const quoteRequest = {
            dry: true,
            swapType: 'EXACT_INPUT',
            slippageTolerance,
            originAsset,
            depositType: 'ORIGIN_CHAIN',
            destinationAsset,
            amount,
            refundTo: '0x0000000000000000000000000000000000000000',
            refundType: 'ORIGIN_CHAIN',
            recipient: '0x0000000000000000000000000000000000000000',
            recipientType: 'DESTINATION_CHAIN',
            deadline,
        };
        return this.requestQuote(quoteRequest);
    }
};
exports.OneClickService = OneClickService;
exports.OneClickService = OneClickService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        chain_keys_service_1.ChainKeysService])
], OneClickService);
//# sourceMappingURL=oneclick.service.js.map