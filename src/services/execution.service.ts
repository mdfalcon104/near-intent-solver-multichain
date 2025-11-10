import { Injectable } from '@nestjs/common';
import { NearService } from './near.service';
import { EvmService } from './evm.service';
import { LockService } from './lock.service';
import { OneClickService } from './oneclick.service';
import { ChainKeysService } from './chain-keys.service';

@Injectable()
export class ExecutionService {
  constructor(
    private near: NearService, 
    private evm: EvmService, 
    private lock: LockService,
    private oneClick: OneClickService,
    private chainKeys: ChainKeysService,
  ) {}

  /**
   * Handle cross-chain execution - Market Maker workflow
   * Flow:
   * 1. User accepts our quote and requests execution
   * 2. We request actual quote from 1Click (with deposit address)
   * 3. We send funds to deposit address using our private key
   * 4. 1Click executes cross-chain swap to final recipient
   * 5. We monitor the swap status
   */
  async handleCrossChainExecution(body: {
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
  }) {
    const key = `intent:${body.intent_id}`;
    const locked = await this.lock.lock(key, 120000); // 2 minute lock for cross-chain
    
    if (!locked) {
      return { status: 'busy', message: 'Intent is already being processed' };
    }

    try {
      // Validate chain is supported
      if (!this.chainKeys.isChainSupported(body.originChain)) {
        await this.lock.unlock(key);
        return { 
          status: 'failed', 
          reason: 'unsupported_origin_chain',
          message: `Chain ${body.originChain} is not configured. Supported chains: ${this.chainKeys.getSupportedChains().join(', ')}`
        };
      }

      // Execute cross-chain swap via 1Click
      // This will:
      // 1. Request quote from 1Click with actual deposit address
      // 2. Send funds from our wallet to deposit address
      // 3. Submit deposit transaction to 1Click
      const result = await this.oneClick.executeCrossChainSwap({
        originChain: body.originChain,
        originAsset: body.originAsset,
        destinationChain: body.destinationChain,
        destinationAsset: body.destinationAsset,
        amount: body.amount,
        recipient: body.recipient,
        refundTo: body.refundTo || body.recipient,
        slippageTolerance: body.slippageTolerance || 100,
      });

      // Start monitoring the swap in background
      this.monitorSwapInBackground(
        result.quote.quote.depositAddress,
        result.quote.quote.depositMemo,
        key,
        body.intent_id,
      );

      return {
        status: 'processing',
        intent_id: body.intent_id,
        quote_id: body.quote_id,
        depositTxHash: result.depositTxHash,
        depositAddress: result.quote.quote.depositAddress,
        swapStatus: result.status.status,
        estimatedTime: result.quote.quote.timeEstimate,
        quote: {
          amountIn: result.quote.quote.amountIn,
          amountOut: result.quote.quote.amountOut,
          deadline: result.quote.quote.deadline,
        },
        message: 'Market Maker has sent funds to 1Click. Cross-chain swap in progress.',
      };
    } catch (error) {
      await this.lock.unlock(key);
      console.error(`[Market Maker] Failed to execute swap:`, error);
      return { 
        status: 'failed', 
        error: String(error),
        message: 'Failed to execute cross-chain swap'
      };
    }
  }

  /**
   * Monitor swap status in background and unlock when complete
   */
  private async monitorSwapInBackground(
    depositAddress: string,
    depositMemo: string | undefined,
    lockKey: string,
    intentId: string,
  ) {
    try {
      const finalStatus = await this.oneClick.monitorSwap(
        depositAddress,
        depositMemo,
        900000, // 15 minutes max for cross-chain
      );
      
      if (finalStatus.swapDetails) {
        
        if (finalStatus.swapDetails.destinationChainTxHashes?.length > 0) {
          
        }
        
        if (finalStatus.status === 'REFUNDED' && finalStatus.swapDetails.refundedAmount) {
          
        }
      }
    } catch (error) {
      // Error logged internally
    } finally {
      await this.lock.unlock(lockKey);
    }
  }

  /**
   * Legacy execution handler (kept for backward compatibility)
   */
  async handleExecution(body: any) {
    const key = `intent:${body.intent_id}`;
    const locked = await this.lock.lock(key, 30000);
    if (!locked) return { status: 'busy' };

    try {
      const chain = body.chain || 'near';
      // In production, construct the exact payload expected by verifier or relayer.
      if (chain === 'near') {
        const tx = await this.near.executeIntent('execute_intents', {
          intents: [body.intent_payload],
        });
        await this.lock.unlock(key);
        return { status: 'ok', txHash: tx.transaction.hash };
      } else {
        // For EVM chains, you'd likely use a relayer or bridge; here we just simulate
        // If rawTx provided, send it
        if (body.rawTx) {
          const sent = await this.evm.sendRawTx(chain, body.rawTx);
          await this.lock.unlock(key);
          return { status: 'ok', txHash: sent.hash };
        }
        await this.lock.unlock(key);
        return { status: 'failed', reason: 'no_evm_payload' };
      }
    } catch (e) {
      await this.lock.unlock(key);
      return { status: 'failed', error: String(e) };
    }
  }

  /**
   * Get swap status by deposit address
   */
  async getSwapStatus(depositAddress: string, depositMemo?: string) {
    try {
      const status = await this.oneClick.getSwapStatus(depositAddress, depositMemo);
      return {
        status: 'ok',
        swapStatus: status.status,
        details: status.swapDetails,
        updatedAt: status.updatedAt,
      };
    } catch (error) {
      return {
        status: 'failed',
        error: String(error),
      };
    }
  }
}
