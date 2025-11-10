import { Injectable } from '@nestjs/common';
import { OneClickService } from './oneclick.service';

@Injectable()
export class PricingService {
  constructor(private oneClick: OneClickService) {}

  /**
   * Generate quotes for cross-chain swaps using 1Click API
   * Market Maker workflow:
   * 1. Receive quote request from user
   * 2. Get best quote from 1Click
   * 3. Add our markup
   * 4. Return quote to user
   */
  async computeQuotes(req: any) {
    try {
      const originAsset = req.originAsset || req.defuse_asset_identifier_in;
      const destinationAsset = req.destinationAsset || req.defuse_asset_identifier_out;
      const amount = req.amount || req.exact_amount_in || req.amount_in;
      const slippageTolerance = req.slippageTolerance || 100; // 1% default

      if (!originAsset || !destinationAsset || !amount) {
        return [];
      }

      // Get quote from 1Click API (dry run - no deposit address)
      const oneClickQuote = await this.oneClick.getQuoteEstimate({
        originAsset,
        destinationAsset,
        amount: amount.toString(),
        slippageTolerance,
      });

      // Add our market maker markup
      const markup = Number(process.env.MARKUP_PCT || 0.005); // 0.5% default
      const ttl = Number(process.env.QUOTE_TTL_MS || 5000);

      const baseAmountOut = Number(oneClickQuote.quote.amountOut);
      const amountOutWithMarkup = Math.floor(baseAmountOut * (1 - markup));

      // Generate unique quote ID for tracking
      const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      return [
        {
          quote_id: quoteId,
          solver_id: process.env.SOLVER_ID || 'market-maker-solver',
          amount_in: oneClickQuote.quote.amountIn,
          amount_out: amountOutWithMarkup.toString(),
          ttl_ms: ttl,
          metadata: {
            originAsset,
            destinationAsset,
            oneClickAmountOut: oneClickQuote.quote.amountOut,
            marketMakerAmountOut: amountOutWithMarkup.toString(),
            markup: markup,
            timeEstimate: oneClickQuote.quote.timeEstimate,
            amountInUsd: oneClickQuote.quote.amountInUsd,
            amountOutUsd: oneClickQuote.quote.amountOutUsd,
          },
        },
      ];
    } catch (error) {
      console.error('Failed to compute quotes:', error);
      return [];
    }
  }

  /**
   * Get direct quote from 1Click for cross-chain swaps
   */
  async getCrossChainQuote(params: {
    originAsset: string;
    destinationAsset: string;
    amount: string;
    slippageTolerance?: number;
  }) {
    try {
      const quote = await this.oneClick.getQuoteEstimate(params);
      
      const markup = Number(process.env.MARKUP_PCT || 0.005);
      const baseAmountOut = Number(quote.quote.amountOut);
      const amountOutWithMarkup = Math.floor(baseAmountOut * (1 - markup));

      return {
        status: 'ok',
        quote: {
          quoteId: `quote_${Date.now()}`,
          amountIn: quote.quote.amountIn,
          amountInFormatted: quote.quote.amountInFormatted,
          amountInUsd: quote.quote.amountInUsd,
          amountOut: amountOutWithMarkup.toString(),
          amountOutFormatted: (Number(quote.quote.amountOutFormatted) * (1 - markup)).toFixed(6),
          baseAmountOut: quote.quote.amountOut,
          baseAmountOutFormatted: quote.quote.amountOutFormatted,
          amountOutUsd: quote.quote.amountOutUsd,
          minAmountOut: quote.quote.minAmountOut,
          timeEstimate: quote.quote.timeEstimate,
          deadline: quote.quote.deadline,
          markup: markup,
          marketMakerFee: (baseAmountOut * markup).toString(),
        },
        timestamp: quote.timestamp,
      };
    } catch (error) {
      throw error;
    }
  }
}
