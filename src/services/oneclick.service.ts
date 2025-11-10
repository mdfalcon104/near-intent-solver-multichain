import { Injectable } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { ChainKeysService } from './chain-keys.service';
import { ethers } from 'ethers';
import axios from 'axios';

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
  appFees?: Array<{ recipient: string; fee: number }>;
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
    originChainTxHashes?: Array<{ hash: string; explorerUrl: string }>;
    destinationChainTxHashes?: Array<{ hash: string; explorerUrl: string }>;
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

@Injectable()
export class OneClickService {
  private readonly baseUrl = 'https://1click.chaindefuser.com';
  private readonly apiVersion = 'v0';
  private jwtToken: string;

  constructor(
    private config: ConfigService,
    private chainKeys: ChainKeysService,
  ) {
    this.jwtToken = this.config.get('ONECLICK_JWT_TOKEN', '');
  }

  /**
   * Get authorization headers for 1Click API
   */
  private getHeaders() {
    const headers: any = {
      'Content-Type': 'application/json',
    };
    
    if (this.jwtToken) {
      headers['Authorization'] = `Bearer ${this.jwtToken}`;
    }
    
    return headers;
  }

  /**
   * Get list of supported tokens
   */
  async getSupportedTokens(): Promise<SupportedToken[]> {
    try {
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/tokens`,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get supported tokens:', error);
      throw error;
    }
  }

  /**
   * Request a swap quote from 1Click API
   */
  async requestQuote(request: QuoteRequest): Promise<QuoteResponse> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/quote`,
        request,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to request quote:', error);
      throw error;
    }
  }

  /**
   * Submit deposit transaction hash to 1Click API
   */
  async submitDepositTx(params: {
    txHash: string;
    depositAddress: string;
    nearSenderAccount?: string;
    memo?: string;
  }): Promise<SwapStatus> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/${this.apiVersion}/deposit/submit`,
        params,
        { headers: this.getHeaders() }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to submit deposit tx:', error);
      throw error;
    }
  }

  /**
   * Check swap execution status
   */
  async getSwapStatus(depositAddress: string, depositMemo?: string): Promise<SwapStatus> {
    try {
      const params: any = { depositAddress };
      if (depositMemo) {
        params.depositMemo = depositMemo;
      }
      
      const response = await axios.get(
        `${this.baseUrl}/${this.apiVersion}/status`,
        {
          headers: this.getHeaders(),
          params,
        }
      );
      return response.data;
    } catch (error) {
      console.error('Failed to get swap status:', error);
      throw error;
    }
  }

  /**
   * Execute a cross-chain swap using 1Click API
   * This will:
   * 1. Request a quote
   * 2. Send funds to the deposit address
   * 3. Submit the deposit transaction
   * 4. Return the swap status
   */
  async executeCrossChainSwap(params: {
    originChain: string;
    originAsset: string;
    destinationChain: string;
    destinationAsset: string;
    amount: string;
    recipient: string;
    refundTo?: string;
    slippageTolerance?: number;
    swapType?: 'EXACT_INPUT' | 'EXACT_OUTPUT' | 'FLEX_INPUT';
  }): Promise<{ quote: QuoteResponse; depositTxHash: string; status: SwapStatus }> {
    const {
      originChain,
      originAsset,
      destinationChain,
      destinationAsset,
      amount,
      recipient,
      refundTo,
      slippageTolerance = 100, // 1% default
      swapType = 'EXACT_INPUT',
    } = params;

    // Step 1: Request quote (dry run first)
    const deadline = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
    
    const quoteRequest: QuoteRequest = {
      dry: false, // Set to false to get actual deposit address
      swapType,
      slippageTolerance,
      originAsset,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset,
      amount,
      refundTo: refundTo || recipient,
      refundType: 'ORIGIN_CHAIN',
      recipient,
      recipientType: 'DESTINATION_CHAIN',
      deadline,
      quoteWaitingTimeMs: 3000,
    };

    const quote = await this.requestQuote(quoteRequest);
    
    // Step 2: Send funds to deposit address
    let depositTxHash: string;
    
    // Get signer for origin chain
    const signer = this.chainKeys.getEvmSigner(originChain);
    if (!signer) {
      throw new Error(`No signer configured for chain: ${originChain}`);
    }

    // Send transaction to deposit address
    const tx = await signer.sendTransaction({
      to: quote.quote.depositAddress,
      value: ethers.parseUnits(amount, 18), // Adjust decimals as needed
    });

    await tx.wait();
    depositTxHash = tx.hash;

    // Step 3: Submit deposit transaction
    const status = await this.submitDepositTx({
      txHash: depositTxHash,
      depositAddress: quote.quote.depositAddress,
      memo: quote.quote.depositMemo,
    });

    return {
      quote,
      depositTxHash,
      status,
    };
  }

  /**
   * Monitor a swap until completion or failure
   */
  async monitorSwap(
    depositAddress: string,
    depositMemo?: string,
    maxWaitTime = 300000, // 5 minutes default
    pollInterval = 5000, // 5 seconds
  ): Promise<SwapStatus> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < maxWaitTime) {
      const status = await this.getSwapStatus(depositAddress, depositMemo);
      
      if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(status.status)) {
        return status;
      }
      
      // Wait before polling again
      await new Promise(resolve => setTimeout(resolve, pollInterval));
    }
    
    throw new Error('Swap monitoring timeout');
  }

  /**
   * Get quote for display purposes (dry run)
   */
  async getQuoteEstimate(params: {
    originAsset: string;
    destinationAsset: string;
    amount: string;
    slippageTolerance?: number;
  }): Promise<QuoteResponse> {
    const { originAsset, destinationAsset, amount, slippageTolerance = 100 } = params;
    
    const deadline = new Date(Date.now() + 3600000).toISOString();
    
    const quoteRequest: QuoteRequest = {
      dry: true, // Dry run - no deposit address generated
      swapType: 'EXACT_INPUT',
      slippageTolerance,
      originAsset,
      depositType: 'ORIGIN_CHAIN',
      destinationAsset,
      amount,
      refundTo: '0x0000000000000000000000000000000000000000', // Dummy address for dry run
      refundType: 'ORIGIN_CHAIN',
      recipient: '0x0000000000000000000000000000000000000000', // Dummy address for dry run
      recipientType: 'DESTINATION_CHAIN',
      deadline,
    };

    return this.requestQuote(quoteRequest);
  }
}
