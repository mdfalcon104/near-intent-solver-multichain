import { Injectable } from '@nestjs/common';
import { OneClickService, SwapStatus } from './oneclick.service';

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

@Injectable()
export class SwapMonitoringService {
  private swaps: Map<string, SwapRecord> = new Map();
  private monitoringIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor(private oneClick: OneClickService) {}

  /**
   * Register a new swap for monitoring
   */
  registerSwap(
    depositAddress: string,
    params: {
      depositMemo?: string;
      intentId: string;
      originChain: string;
      destinationChain: string;
      amount: string;
      recipient: string;
      depositTxHash?: string;
    }
  ): void {
    const record: SwapRecord = {
      depositAddress,
      depositMemo: params.depositMemo,
      intentId: params.intentId,
      status: 'PENDING_DEPOSIT',
      originChain: params.originChain,
      destinationChain: params.destinationChain,
      amount: params.amount,
      recipient: params.recipient,
      createdAt: new Date(),
      updatedAt: new Date(),
      depositTxHash: params.depositTxHash,
    };

    this.swaps.set(depositAddress, record);
    this.startMonitoring(depositAddress, params.depositMemo);
  }

  /**
   * Start monitoring a swap
   */
  private startMonitoring(depositAddress: string, depositMemo?: string): void {
    // Don't start if already monitoring
    if (this.monitoringIntervals.has(depositAddress)) {
      return;
    }

    const interval = setInterval(async () => {
      try {
        await this.updateSwapStatus(depositAddress, depositMemo);
      } catch (error) {
        console.error(`Error monitoring swap ${depositAddress}:`, error);
      }
    }, 10000); // Check every 10 seconds

    this.monitoringIntervals.set(depositAddress, interval);

    // Auto-cleanup after 1 hour
    setTimeout(() => {
      this.stopMonitoring(depositAddress);
    }, 3600000);
  }

  /**
   * Update swap status from 1Click API
   */
  private async updateSwapStatus(depositAddress: string, depositMemo?: string): Promise<void> {
    const record = this.swaps.get(depositAddress);
    if (!record) {
      return;
    }

    try {
      const status = await this.oneClick.getSwapStatus(depositAddress, depositMemo);
      
      record.status = status.status;
      record.updatedAt = new Date();

      if (status.swapDetails) {
        if (status.swapDetails.destinationChainTxHashes?.[0]) {
          record.finalTxHash = status.swapDetails.destinationChainTxHashes[0].hash;
        }
      }

      // Stop monitoring if swap is in final state
      if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(status.status)) {
        record.completedAt = new Date();
        this.stopMonitoring(depositAddress);
        
        console.log(`Swap ${depositAddress} completed with status: ${status.status}`);
      }

      this.swaps.set(depositAddress, record);
    } catch (error) {
      record.error = String(error);
      record.updatedAt = new Date();
      this.swaps.set(depositAddress, record);
    }
  }

  /**
   * Stop monitoring a swap
   */
  private stopMonitoring(depositAddress: string): void {
    const interval = this.monitoringIntervals.get(depositAddress);
    if (interval) {
      clearInterval(interval);
      this.monitoringIntervals.delete(depositAddress);
    }
  }

  /**
   * Get swap record by deposit address
   */
  getSwap(depositAddress: string): SwapRecord | undefined {
    return this.swaps.get(depositAddress);
  }

  /**
   * Get swap record by intent ID
   */
  getSwapByIntentId(intentId: string): SwapRecord | undefined {
    return Array.from(this.swaps.values()).find(
      swap => swap.intentId === intentId
    );
  }

  /**
   * Get all active swaps
   */
  getActiveSwaps(): SwapRecord[] {
    return Array.from(this.swaps.values()).filter(
      swap => !['SUCCESS', 'FAILED', 'REFUNDED'].includes(swap.status)
    );
  }

  /**
   * Get all swaps
   */
  getAllSwaps(): SwapRecord[] {
    return Array.from(this.swaps.values());
  }

  /**
   * Get swaps by status
   */
  getSwapsByStatus(status: string): SwapRecord[] {
    return Array.from(this.swaps.values()).filter(
      swap => swap.status === status
    );
  }

  /**
   * Clean up old completed swaps
   */
  cleanup(olderThanMs = 86400000): void {
    const cutoffTime = Date.now() - olderThanMs;
    
    for (const [depositAddress, record] of this.swaps.entries()) {
      if (
        record.completedAt &&
        record.completedAt.getTime() < cutoffTime
      ) {
        this.swaps.delete(depositAddress);
        this.stopMonitoring(depositAddress);
      }
    }
  }

  /**
   * Force refresh a swap status
   */
  async refreshSwapStatus(depositAddress: string, depositMemo?: string): Promise<SwapRecord | null> {
    await this.updateSwapStatus(depositAddress, depositMemo);
    return this.getSwap(depositAddress) || null;
  }
}
