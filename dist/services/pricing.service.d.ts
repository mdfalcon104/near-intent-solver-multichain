import { OneClickService } from './oneclick.service';
export declare class PricingService {
    private oneClick;
    constructor(oneClick: OneClickService);
    computeQuotes(req: any): Promise<{
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
    }[]>;
    getCrossChainQuote(params: {
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
    }>;
}
