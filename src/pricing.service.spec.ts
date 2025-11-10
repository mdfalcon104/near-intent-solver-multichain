import { PricingService } from './services/pricing.service';
import { OneClickService } from './services/oneclick.service';
import { ChainKeysService } from './services/chain-keys.service';
import { ConfigService } from './config/config.service';

describe('PricingService', () => {
  let pricingService: PricingService;
  let oneClickService: OneClickService;

  beforeEach(() => {
    const configService = new ConfigService();
    const chainKeysService = new ChainKeysService(configService);
    oneClickService = new OneClickService(configService, chainKeysService);
    pricingService = new PricingService(oneClickService);
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
