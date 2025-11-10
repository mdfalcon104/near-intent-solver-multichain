"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const pricing_service_1 = require("./services/pricing.service");
const oneclick_service_1 = require("./services/oneclick.service");
const chain_keys_service_1 = require("./services/chain-keys.service");
const config_service_1 = require("./config/config.service");
describe('PricingService', () => {
    let pricingService;
    let oneClickService;
    beforeEach(() => {
        const configService = new config_service_1.ConfigService();
        const chainKeysService = new chain_keys_service_1.ChainKeysService(configService);
        oneClickService = new oneclick_service_1.OneClickService(configService, chainKeysService);
        pricingService = new pricing_service_1.PricingService(oneClickService);
    });
    it('should return quotes array', async () => {
        const res = await pricingService.computeQuotes({
            originAsset: 'nep141:wrap.near',
            destinationAsset: 'nep141:usdc.near',
            amount: '1000000000000000000000000'
        });
        expect(Array.isArray(res)).toBe(true);
    });
});
//# sourceMappingURL=pricing.service.spec.js.map