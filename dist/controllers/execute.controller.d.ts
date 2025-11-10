import { ExecutionService } from '../services/execution.service';
export declare class ExecuteController {
    private execService;
    constructor(execService: ExecutionService);
    execute(body: any): Promise<{
        status: string;
        txHash?: undefined;
        reason?: undefined;
        error?: undefined;
    } | {
        status: string;
        txHash: any;
        reason?: undefined;
        error?: undefined;
    } | {
        status: string;
        reason: string;
        txHash?: undefined;
        error?: undefined;
    } | {
        status: string;
        error: string;
        txHash?: undefined;
        reason?: undefined;
    }>;
    executeCrossChain(body: {
        quote_id?: string;
        intent_id: string;
        originChain: string;
        originAsset: string;
        destinationChain: string;
        destinationAsset: string;
        amount: string;
        recipient: string;
        refundTo?: string;
        slippageTolerance?: number;
    }): Promise<{
        status: string;
        message: string;
        reason?: undefined;
        intent_id?: undefined;
        quote_id?: undefined;
        depositTxHash?: undefined;
        depositAddress?: undefined;
        swapStatus?: undefined;
        estimatedTime?: undefined;
        quote?: undefined;
        error?: undefined;
    } | {
        status: string;
        reason: string;
        message: string;
        intent_id?: undefined;
        quote_id?: undefined;
        depositTxHash?: undefined;
        depositAddress?: undefined;
        swapStatus?: undefined;
        estimatedTime?: undefined;
        quote?: undefined;
        error?: undefined;
    } | {
        status: string;
        intent_id: string;
        quote_id: string;
        depositTxHash: string;
        depositAddress: string;
        swapStatus: "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "INCOMPLETE_DEPOSIT" | "REFUNDED" | "FAILED" | "KNOWN_DEPOSIT_TX";
        estimatedTime: number;
        quote: {
            amountIn: string;
            amountOut: string;
            deadline: string;
        };
        message: string;
        reason?: undefined;
        error?: undefined;
    } | {
        status: string;
        error: string;
        message: string;
        reason?: undefined;
        intent_id?: undefined;
        quote_id?: undefined;
        depositTxHash?: undefined;
        depositAddress?: undefined;
        swapStatus?: undefined;
        estimatedTime?: undefined;
        quote?: undefined;
    }>;
    getSwapStatus(depositAddress: string, depositMemo?: string): Promise<{
        status: string;
        swapStatus: "PENDING_DEPOSIT" | "PROCESSING" | "SUCCESS" | "INCOMPLETE_DEPOSIT" | "REFUNDED" | "FAILED" | "KNOWN_DEPOSIT_TX";
        details: {
            intentHashes?: string[];
            nearTxHashes?: string[];
            amountIn: string;
            amountInFormatted: string;
            amountInUsd: string;
            amountOut: string;
            amountOutFormatted: string;
            amountOutUsd: string;
            slippage: number;
            originChainTxHashes?: Array<{
                hash: string;
                explorerUrl: string;
            }>;
            destinationChainTxHashes?: Array<{
                hash: string;
                explorerUrl: string;
            }>;
            refundedAmount?: string;
            refundedAmountFormatted?: string;
            refundedAmountUsd?: string;
        };
        updatedAt: string;
        error?: undefined;
    } | {
        status: string;
        error: string;
    }>;
}
