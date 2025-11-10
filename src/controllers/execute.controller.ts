import { Controller, Post, Body, HttpCode, Get, Query } from '@nestjs/common';
import { ExecutionService } from '../services/execution.service';

@Controller()
export class ExecuteController {
  constructor(private execService: ExecutionService) {}

  /**
   * Legacy execute endpoint (backward compatibility)
   */
  @Post('execute')
  @HttpCode(200)
  async execute(@Body() body: any) {
    const result = await this.execService.handleExecution(body);
    return result;
  }

  /**
   * Cross-chain execute endpoint - Market Maker receives execution request
   * Flow:
   * 1. User accepts MM's quote and requests execution
   * 2. MM validates request and checks if can fulfill
   * 3. MM requests real quote from 1Click (with deposit address)
   * 4. MM sends funds from own wallet to 1Click deposit address
   * 5. 1Click handles cross-chain swap to final recipient
   * 6. MM monitors and confirms completion
   */
  @Post('execute/cross-chain')
  @HttpCode(200)
  async executeCrossChain(@Body() body: {
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
    const result = await this.execService.handleCrossChainExecution(body);
    return result;
  }

  /**
   * Get swap status by deposit address
   */
  @Get('swap/status')
  @HttpCode(200)
  async getSwapStatus(
    @Query('depositAddress') depositAddress: string,
    @Query('depositMemo') depositMemo?: string,
  ) {
    if (!depositAddress) {
      return {
        status: 'failed',
        error: 'depositAddress is required',
      };
    }
    
    const result = await this.execService.getSwapStatus(depositAddress, depositMemo);
    return result;
  }
}
