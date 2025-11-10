import { OneClickService } from './oneclick.service';
export interface SwapRecord {
    depositAddress: string;
    depositMemo?: string;
    intentId: string;
    status: string;
    originChain: string;
    destinationChain: string;
    amount: string;
    recipient: string;
    createdAt: Date;
    updatedAt: Date;
    completedAt?: Date;
    depositTxHash?: string;
    finalTxHash?: string;
    error?: string;
}
export declare class SwapMonitoringService {
    private oneClick;
    private swaps;
    private monitoringIntervals;
    constructor(oneClick: OneClickService);
    registerSwap(depositAddress: string, params: {
        depositMemo?: string;
        intentId: string;
        originChain: string;
        destinationChain: string;
        amount: string;
        recipient: string;
        depositTxHash?: string;
    }): void;
    private startMonitoring;
    private updateSwapStatus;
    private stopMonitoring;
    getSwap(depositAddress: string): SwapRecord | undefined;
    getSwapByIntentId(intentId: string): SwapRecord | undefined;
    getActiveSwaps(): SwapRecord[];
    getAllSwaps(): SwapRecord[];
    getSwapsByStatus(status: string): SwapRecord[];
    cleanup(olderThanMs?: number): void;
    refreshSwapStatus(depositAddress: string, depositMemo?: string): Promise<SwapRecord | null>;
}
