import { PricingService } from '../services/pricing.service';
import { OneClickService } from '../services/oneclick.service';
export declare class QuoteController {
    private pricingService;
    private oneClick;
    constructor(pricingService: PricingService, oneClick: OneClickService);
    quote(req: any): Promise<{
        quotes: {
            quote_id: string;
            solver_id: string;
            amount_in: string;
            amount_out: string;
            ttl_ms: number;
            metadata: {
                originAsset: any;
                destinationAsset: any;
                oneClickAmountOut: string;
                marketMakerAmountOut: string;
                markup: number;
                timeEstimate: number;
                amountInUsd: string;
                amountOutUsd: string;
            };
        }[];
    }>;
    crossChainQuote(req: {
        originAsset: string;
        destinationAsset: string;
        amount: string;
        slippageTolerance?: number;
    }): Promise<{
        status: string;
        quote: {
            quoteId: string;
            amountIn: string;
            amountInFormatted: string;
            amountInUsd: string;
            amountOut: string;
            amountOutFormatted: string;
            baseAmountOut: string;
            baseAmountOutFormatted: string;
            amountOutUsd: string;
            minAmountOut: string;
            timeEstimate: number;
            deadline: string;
            markup: number;
            marketMakerFee: string;
        };
        timestamp: string;
    } | {
        status: string;
        error: string;
    }>;
    getSupportedTokens(): Promise<{
        status: string;
        tokens: import("../services/oneclick.service").SupportedToken[];
        error?: undefined;
    } | {
        status: string;
        error: string;
        tokens?: undefined;
    }>;
}
