import { Controller, Post, Body, HttpCode, Get, Query } from '@nestjs/common';
import { PricingService } from '../services/pricing.service';
import { OneClickService } from '../services/oneclick.service';

@Controller()
export class QuoteController {
  constructor(
    private pricingService: PricingService,
    private oneClick: OneClickService,
  ) {}

  /**
   * Legacy quote endpoint (backward compatibility)
   */
  @Post('quote')
  @HttpCode(200)
  async quote(@Body() req: any) {
    const quotes = await this.pricingService.computeQuotes(req);
    return { quotes };
  }

  /**
   * Cross-chain quote endpoint - Market Maker returns quote with markup
   * Flow:
   * 1. User requests quote for cross-chain swap
   * 2. MM gets quote from 1Click API
   * 3. MM adds markup and returns quote to user
   */
  @Post('quote/cross-chain')
  @HttpCode(200)
  async crossChainQuote(@Body() req: {
    originAsset: string;
    destinationAsset: string;
    amount: string;
    slippageTolerance?: number;
  }) {
    try {
      const quote = await this.pricingService.getCrossChainQuote({
        originAsset: req.originAsset,
        destinationAsset: req.destinationAsset,
        amount: req.amount,
        slippageTolerance: req.slippageTolerance,
      });

      return quote;
    } catch (error) {
      return {
        status: 'failed',
        error: String(error),
      };
    }
  }

  /**
   * Get list of supported tokens for cross-chain swaps
   */
  @Get('tokens/supported')
  @HttpCode(200)
  async getSupportedTokens() {
    try {
      const tokens = await this.oneClick.getSupportedTokens();
      return {
        status: 'ok',
        tokens,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: String(error),
      };
    }
  }
}
