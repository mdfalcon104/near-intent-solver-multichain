import { Controller, Post, Get, Body, Query, Logger } from '@nestjs/common';
import { DepositWithdrawalService } from '../services/deposit-withdrawal.service';

@Controller('deposit-withdrawal')
export class DepositWithdrawalController {
  private readonly logger = new Logger(DepositWithdrawalController.name);

  constructor(private depositWithdrawal: DepositWithdrawalService) {}

  /**
   * GET /deposit-withdrawal/balance
   * Query balance for a token
   */
  @Get('balance')
  async getBalance(@Query('token_id') token_id?: string) {
    this.logger.log(`[API] GET /deposit-withdrawal/balance`);
    this.logger.log(`  Token: ${token_id || 'NEAR'}`);

    try {
      const balance = await this.depositWithdrawal.getBalance(token_id);
      return {
        success: true,
        token_id: token_id || 'NEAR',
        balance: balance,
      };
    } catch (error) {
      this.logger.error(`[API] Get balance failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/balance/available
   * Query available balance (not locked in quotes)
   */
  @Get('balance/available')
  async getAvailableBalance(@Query('token_id') token_id?: string) {
    this.logger.log(`[API] GET /deposit-withdrawal/balance/available`);
    this.logger.log(`  Token: ${token_id || 'NEAR'}`);

    try {
      const balance = await this.depositWithdrawal.getAvailableBalance(
        token_id,
      );
      return {
        success: true,
        token_id: token_id || 'NEAR',
        available_balance: balance,
      };
    } catch (error) {
      this.logger.error(`[API] Get available balance failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/history
   * Get deposit/withdrawal transaction history
   */
  @Get('history')
  async getHistory(@Query('limit') limit?: string) {
    this.logger.log(`[API] GET /deposit-withdrawal/history`);
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.logger.log(`  Limit: ${limitNum}`);

    try {
      const history = await this.depositWithdrawal.getDepositWithdrawalHistory(
        limitNum,
      );
      return {
        success: true,
        history: history,
      };
    } catch (error) {
      this.logger.error(`[API] Get history failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/stats
   * Get deposit/withdrawal account statistics
   */
  @Get('stats')
  async getStats() {
    this.logger.log(`[API] GET /deposit-withdrawal/stats`);

    try {
      const stats = await this.depositWithdrawal.getAccountStats();
      return {
        success: true,
        stats: stats,
      };
    } catch (error) {
      this.logger.error(`[API] Get stats failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * ========== Chaindefuser Bridge Integration Endpoints ==========
   */

  /**
   * GET /deposit-withdrawal/bridge/supported-assets
   * Get supported assets from Chaindefuser Bridge
   */
  @Get('bridge/supported-assets')
  async getSupportedAssets() {
    this.logger.log(`[API] GET /deposit-withdrawal/bridge/supported-assets`);

    try {
      const assets = await this.depositWithdrawal.getSupportedAssets();
      return {
        success: true,
        assets: assets,
      };
    } catch (error) {
      this.logger.error(`[API] Get supported assets failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * POST /deposit-withdrawal/bridge/deposit
   * Deposit via Chaindefuser Bridge
   * Request: { symbol, chain, amount }
   * Returns deposit address for user to send funds
   */
  @Post('bridge/deposit')
  async depositViaBridge(
    @Body('symbol') symbol: string,
    @Body('chain') chain: string,
    @Body('amount') amount: string,
  ) {
    this.logger.log(`[API] POST /deposit-withdrawal/bridge/deposit`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const result = await this.depositWithdrawal.depositViaBridge(
        symbol,
        chain,
        amount,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`[API] Bridge deposit failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * POST /deposit-withdrawal/bridge/withdraw
   * Withdraw via Chaindefuser Bridge
   * Request: { symbol, chain, amount, recipientAddress }
   */
  @Post('bridge/withdraw')
  async withdrawViaBridge(
    @Body('symbol') symbol: string,
    @Body('chain') chain: string,
    @Body('amount') amount: string,
    @Body('recipientAddress') recipientAddress: string,
  ) {
    this.logger.log(`[API] POST /deposit-withdrawal/bridge/withdraw`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);

    try {
      const result = await this.depositWithdrawal.withdrawViaBridge(
        symbol,
        chain,
        amount,
        recipientAddress,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`[API] Bridge withdrawal failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/bridge/recent-deposits
   * Get recent deposits for an address
   */
  @Get('bridge/recent-deposits')
  async getRecentDepositsViaBridge(
    @Query('address') address: string,
    @Query('limit') limit?: string,
  ) {
    this.logger.log(`[API] GET /deposit-withdrawal/bridge/recent-deposits`);
    this.logger.log(`  Address: ${address}`);
    const limitNum = limit ? parseInt(limit, 10) : 10;
    this.logger.log(`  Limit: ${limitNum}`);

    try {
      const deposits = await this.depositWithdrawal.getRecentDepositsViaBridge(
        address,
        limitNum,
      );
      return {
        success: true,
        deposits: deposits,
      };
    } catch (error) {
      this.logger.error(`[API] Get recent deposits failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/bridge/withdrawal-status/:withdrawalId
   * Get withdrawal status
   */
  @Get('bridge/withdrawal-status/:withdrawalId')
  async getWithdrawalStatusViaBridge(
    @Query('withdrawalId') withdrawalId: string,
  ) {
    this.logger.log(`[API] GET /deposit-withdrawal/bridge/withdrawal-status`);
    this.logger.log(`  Withdrawal ID: ${withdrawalId}`);

    try {
      const status = await this.depositWithdrawal.getWithdrawalStatusViaBridge(
        withdrawalId,
      );
      return {
        success: true,
        status: status,
      };
    } catch (error) {
      this.logger.error(`[API] Get withdrawal status failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * POST /deposit-withdrawal/bridge/notify-deposit
   * Notify bridge about deposit transaction
   * Request: { txHash, chain, symbol, amount }
   */
  @Post('bridge/notify-deposit')
  async notifyDepositTransaction(
    @Body('txHash') txHash: string,
    @Body('chain') chain: string,
    @Body('symbol') symbol: string,
    @Body('amount') amount: string,
  ) {
    this.logger.log(`[API] POST /deposit-withdrawal/bridge/notify-deposit`);
    this.logger.log(`  TX Hash: ${txHash}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const result = await this.depositWithdrawal.notifyDepositTransaction(
        txHash,
        chain,
        symbol,
        amount,
      );
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      this.logger.error(`[API] Notify deposit failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/bridge/estimate-fee
   * Estimate withdrawal fee
   * Query params: symbol, chain, amount
   */
  @Get('bridge/estimate-fee')
  async estimateWithdrawalFeeViaBridge(
    @Query('symbol') symbol: string,
    @Query('chain') chain: string,
    @Query('amount') amount: string,
  ) {
    this.logger.log(`[API] GET /deposit-withdrawal/bridge/estimate-fee`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      const estimate = await this.depositWithdrawal.estimateWithdrawalFeeViaBridge(
        symbol,
        chain,
        amount,
      );
      return {
        success: true,
        estimate: estimate,
      };
    } catch (error) {
      this.logger.error(`[API] Estimate fee failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /deposit-withdrawal/bridge/chain-tokens
   * Get supported tokens for a specific chain
   * Query param: chain
   */
  @Get('bridge/chain-tokens')
  async getChainTokens(@Query('chain') chain: string) {
    this.logger.log(`[API] GET /deposit-withdrawal/bridge/chain-tokens`);
    this.logger.log(`  Chain: ${chain}`);

    try {
      const tokens = this.depositWithdrawal.getChainTokens(chain);
      return {
        success: true,
        chain: chain,
        tokens: tokens,
      };
    } catch (error) {
      this.logger.error(`[API] Get chain tokens failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }
}
