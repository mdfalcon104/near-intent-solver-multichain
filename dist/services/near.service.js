"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NearService = void 0;
const common_1 = require("@nestjs/common");
const near_api_js_1 = require("near-api-js");
let NearService = class NearService {
    async init() {
        if (this.account)
            return;
        const keyStore = new near_api_js_1.keyStores.InMemoryKeyStore();
        const keyPair = near_api_js_1.KeyPair.fromString(process.env.NEAR_PRIVATE_KEY);
        await keyStore.setKey(process.env.NEAR_NETWORK, process.env.NEAR_ACCOUNT_ID, keyPair);
        const near = await (0, near_api_js_1.connect)({
            networkId: process.env.NEAR_NETWORK,
            nodeUrl: process.env.NEAR_NODE_URL,
            deps: { keyStore },
        });
        this.account = await near.account(process.env.NEAR_ACCOUNT_ID);
    }
    async executeIntent(method, args) {
        if (!this.account)
            await this.init();
        return this.account.functionCall({
            contractId: process.env.VERIFIER_CONTRACT,
            methodName: method,
            args,
            gas: '100000000000000',
            attachedDeposit: '0',
        });
    }
    async viewFunction(contractId, methodName, args) {
        if (!this.account)
            await this.init();
        return this.account.connection.provider.query({
            request_type: 'call_function',
            account_id: contractId,
            method_name: methodName,
            args_base64: Buffer.from(JSON.stringify(args)).toString('base64'),
            finality: 'optimistic',
        });
    }
};
exports.NearService = NearService;
exports.NearService = NearService = __decorate([
    (0, common_1.Injectable)()
], NearService);
//# sourceMappingURL=near.service.js.map