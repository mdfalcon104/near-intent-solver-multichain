import { ConfigService } from '../config/config.service';
import { ChainKeysService } from './chain-keys.service';
export interface QuoteRequest {
    dry?: boolean;
    depositMode?: 'SIMPLE' | 'MEMO';
    swapType: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'FLEX_INPUT' | 'ANY_INPUT';
    slippageTolerance: number;
    originAsset: string;
    depositType: 'ORIGIN_CHAIN' | 'INTENTS';
    destinationAsset: string;
    amount: string;
    refundTo: string;
    refundType: 'ORIGIN_CHAIN' | 'INTENTS';
    recipient: string;
    recipientType: 'DESTINATION_CHAIN' | 'INTENTS';
    deadline: string;
    referral?: string;
    quoteWaitingTimeMs?: number;
    appFees?: Array<{
        recipient: string;
        fee: number;
    }>;
    connectedWallets?: string[];
    sessionId?: string;
}
export interface QuoteResponse {
    timestamp: string;
    signature: string;
    quoteRequest: QuoteRequest;
    quote: {
        depositAddress: string;
        depositMemo?: string;
        amountIn: string;
        amountInFormatted: string;
        amountInUsd: string;
        minAmountIn?: string;
        amountOut: string;
        amountOutFormatted: string;
        amountOutUsd: string;
        minAmountOut: string;
        deadline: string;
        timeWhenInactive: string;
        timeEstimate: number;
    };
}
export interface SwapStatus {
    quoteResponse: QuoteResponse;
    status: 'PENDING_DEPOSIT' | 'PROCESSING' | 'SUCCESS' | 'INCOMPLETE_DEPOSIT' | 'REFUNDED' | 'FAILED' | 'KNOWN_DEPOSIT_TX';
    updatedAt: string;
    swapDetails?: {
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
}
export interface SupportedToken {
    assetId: string;
    decimals: number;
    blockchain: string;
    symbol: string;
    price: string;
    priceUpdatedAt: string;
    contractAddress: string;
}
export declare class OneClickService {
    private config;
    private chainKeys;
    private readonly baseUrl;
    private readonly apiVersion;
    private jwtToken;
    constructor(config: ConfigService, chainKeys: ChainKeysService);
    private getHeaders;
    getSupportedTokens(): Promise<SupportedToken[]>;
    requestQuote(request: QuoteRequest): Promise<QuoteResponse>;
    submitDepositTx(params: {
        txHash: string;
        depositAddress: string;
        nearSenderAccount?: string;
        memo?: string;
    }): Promise<SwapStatus>;
    getSwapStatus(depositAddress: string, depositMemo?: string): Promise<SwapStatus>;
    executeCrossChainSwap(params: {
        originChain: string;
        originAsset: string;
        destinationChain: string;
        destinationAsset: string;
        amount: string;
        recipient: string;
        refundTo?: string;
        slippageTolerance?: number;
        swapType?: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'FLEX_INPUT';
    }): Promise<{
        quote: QuoteResponse;
        depositTxHash: string;
        status: SwapStatus;
    }>;
    monitorSwap(depositAddress: string, depositMemo?: string, maxWaitTime?: number, pollInterval?: number): Promise<SwapStatus>;
    getQuoteEstimate(params: {
        originAsset: string;
        destinationAsset: string;
        amount: string;
        slippageTolerance?: number;
    }): Promise<QuoteResponse>;
}
