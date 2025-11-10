"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvmService = void 0;
const common_1 = require("@nestjs/common");
const ethers_1 = require("ethers");
let EvmService = class EvmService {
    constructor() {
        this.providers = {};
    }
    getProvider(chain) {
        if (this.providers[chain])
            return this.providers[chain];
        const rpc = chain === 'aurora' ? process.env.AURORA_RPC : process.env.ARBITRUM_RPC;
        const p = new ethers_1.ethers.JsonRpcProvider(rpc);
        this.providers[chain] = p;
        return p;
    }
    getWallet(chain) {
        const pk = process.env.EVM_PRIVATE_KEY || '';
        const provider = this.getProvider(chain);
        return new ethers_1.ethers.Wallet(pk, provider);
    }
    async sendRawTx(chain, rawTx) {
        const provider = this.getProvider(chain);
        return provider.broadcastTransaction(rawTx);
    }
};
exports.EvmService = EvmService;
exports.EvmService = EvmService = __decorate([
    (0, common_1.Injectable)()
], EvmService);
//# sourceMappingURL=evm.service.js.map