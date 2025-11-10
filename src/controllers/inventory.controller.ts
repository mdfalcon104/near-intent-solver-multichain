import { Controller, Get, Post, Query, Logger } from '@nestjs/common';
import { InventoryService } from '../services/inventory.service';

/**
 * Inventory Management Controller
 * Handles inventory queries and balance synchronization with NEAR intents contract
 */
@Controller('inventory')
export class InventoryController {
  private readonly logger = new Logger(InventoryController.name);

  constructor(private inventory: InventoryService) {}

  /**
   * GET /inventory/summary
   * Get current inventory summary from local cache
   */
  @Get('summary')
  getInventorySummary() {
    this.logger.log(`[API] GET /inventory/summary`);

    try {
      const summary = this.inventory.getInventorySummary();
      return {
        success: true,
        data: summary,
      };
    } catch (error) {
      this.logger.error(`[API] Get inventory summary failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * POST /inventory/sync-token
   * Sync a specific token balance from NEAR intents contract
   * Fetches live balance and updates local inventory
   * 
   * Request body:
   * {
   *   "chain": "near",
   *   "token": "USDC",
   *   "tokenId": "nep141:usdc.tether-token.near"
   * }
   */
  @Post('sync-token')
  async syncTokenBalance(
    @Query('chain') chain: string,
    @Query('token') token: string,
    @Query('tokenId') tokenId: string,
  ) {
    this.logger.log(`[API] POST /inventory/sync-token`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Token: ${token}`);
    this.logger.log(`  TokenId: ${tokenId}`);

    try {
      const newBalance = await this.inventory.syncTokenBalance(
        chain,
        token,
        tokenId,
      );
      return {
        success: true,
        chain,
        token,
        tokenId,
        newBalance,
      };
    } catch (error) {
      this.logger.error(`[API] Token balance sync failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * POST /inventory/sync-all
   * Sync all token balances from NEAR intents contract
   * Updates all token balances in inventory to match contract state
   */
  @Post('sync-all')
  async syncAllTokenBalances() {
    this.logger.log(`[API] POST /inventory/sync-all`);

    try {
      const results = await this.inventory.syncAllTokenBalances();
      return {
        success: true,
        message: 'All token balances synced successfully',
        data: results,
      };
    } catch (error) {
      this.logger.error(`[API] Full sync failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }

  /**
   * GET /inventory/balance
   * Fetch a specific token balance from NEAR intents contract (read-only)
   * Does not update local inventory
   * 
   * Query params:
   * - tokenId: NEP-141 token identifier (e.g., "nep141:wrap.near")
   * - accountId: (optional) Account to query (defaults to NEAR_ACCOUNT_ID)
   */
  @Get('balance')
  async getTokenBalance(
    @Query('tokenId') tokenId: string,
    @Query('accountId') accountId?: string,
  ) {
    this.logger.log(`[API] GET /inventory/balance`);
    this.logger.log(`  TokenId: ${tokenId}`);
    if (accountId) {
      this.logger.log(`  AccountId: ${accountId}`);
    }

    try {
      const balance = await this.inventory.fetchTokenBalanceFromContract(
        tokenId,
        accountId,
      );
      return {
        success: true,
        tokenId,
        accountId: accountId || 'default',
        balance,
      };
    } catch (error) {
      this.logger.error(`[API] Get token balance failed: ${error}`);
      return {
        success: false,
        error: (error as any).message,
      };
    }
  }
}
