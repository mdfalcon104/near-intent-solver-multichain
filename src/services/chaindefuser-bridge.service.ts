import { Injectable, Logger } from '@nestjs/common';
import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Chaindefuser Bridge RPC Service
 * Integrates with https://bridge.chaindefuser.com/rpc
 * Provides deposit/withdrawal functionality for supported tokens
 */

interface SupportedAsset {
  network: string;
  address: string;
  symbol: string;
  decimals: number;
  isNative: boolean;
}

interface DepositAddress {
  address: string;
  network: string;
  asset: string;
  minDeposit: string;
  maxDeposit?: string;
}

interface RecentDeposit {
  txHash: string;
  network: string;
  asset: string;
  amount: string;
  timestamp: number;
  status: 'pending' | 'confirmed' | 'completed';
}

interface WithdrawalStatus {
  withdrawalId: string;
  txHash: string;
  network: string;
  asset: string;
  amount: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  estimatedTime?: number;
}

interface WithdrawalFeeEstimate {
  asset: string;
  network: string;
  amount: string;
  fee: string;
  feePercentage: number;
  total: string;
  estimatedTime: number;
}

interface InventoryChain {
  enabled: boolean;
  tokens: Array<{
    address: string;
    symbol: string;
    decimals: number;
    minBalance?: string;
    currentBalance?: string;
    enabled?: boolean;
  }>;
}

interface InventoryData {
  chains: {
    [key: string]: InventoryChain;
  };
}

@Injectable()
export class ChaindefuserBridgeService {
  private readonly logger = new Logger(ChaindefuserBridgeService.name);
  private readonly rpcUrl = 'https://bridge.chaindefuser.com/rpc';
  private readonly httpClient: AxiosInstance;
  private inventoryData: InventoryData;
  private tokenMapping: Map<string, Map<string, any>>;

  constructor() {
    this.httpClient = axios.create({
      baseURL: this.rpcUrl,
      timeout: 30000,
    });
    this.tokenMapping = new Map();
    this.loadInventory();
  }

  /**
   * Load inventory.json and build token mapping
   */
  private loadInventory(): void {
    try {
      const inventoryPath = path.join(
        process.cwd(),
        'inventory.json',
      );
      const rawData = fs.readFileSync(inventoryPath, 'utf-8');
      this.inventoryData = JSON.parse(rawData);
      
      // Build token mapping: symbol -> { network, address, decimals }
      for (const [chain, chainData] of Object.entries(
        this.inventoryData.chains,
      )) {
        if (!chainData.enabled) continue;
        
        for (const token of chainData.tokens) {
          const key = `${token.symbol}:${chain}`;
          const mapping = new Map();
          mapping.set('network', this.mapChainName(chain));
          mapping.set('address', token.address);
          mapping.set('decimals', token.decimals);
          mapping.set('chainName', chain);
          mapping.set('minBalance', token.minBalance);
          mapping.set('currentBalance', token.currentBalance);
          this.tokenMapping.set(key, mapping);
          
          this.logger.debug(
            `[Inventory] Loaded: ${token.symbol} on ${chain} at ${token.address}`,
          );
        }
      }

      this.logger.log(
        `[Inventory] Loaded ${this.tokenMapping.size} token mappings`,
      );
    } catch (error) {
      this.logger.error(`[Inventory] Failed to load inventory: ${error}`);
      throw error;
    }
  }

  /**
   * Map internal chain names to Chaindefuser network names
   */
  private mapChainName(chainName: string): string {
    const mapping: { [key: string]: string } = {
      arbitrum: 'arbitrum',
      base: 'base',
      ethereum: 'ethereum',
      polygon: 'polygon',
      near: 'near',
      bitcoin: 'bitcoin',
      solana: 'solana',
      avalanche: 'avalanche',
      bsc: 'bsc',
      optimism: 'optimism',
      aurora: 'aurora',
    };
    return mapping[chainName] || chainName;
  }

  /**
   * Get supported assets from inventory
   * Returns list of all enabled tokens across all networks
   */
  async getSupportedAssets(): Promise<SupportedAsset[]> {
    this.logger.log('[GetSupportedAssets] Querying supported assets...');

    const assets: SupportedAsset[] = [];

    try {
      for (const [chain, chainData] of Object.entries(
        this.inventoryData.chains,
      )) {
        if (!chainData.enabled) continue;

        for (const token of chainData.tokens) {
          if (token.enabled === false) continue;

          assets.push({
            network: this.mapChainName(chain),
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            isNative: token.address === 'native',
          });
        }
      }

      this.logger.log(
        `[GetSupportedAssets] ✅ Found ${assets.length} supported assets`,
      );
      return assets;
    } catch (error) {
      this.logger.error(`[GetSupportedAssets] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get deposit address for a token on a network
   * Calls Chaindefuser RPC: get_deposit_address
   */
  async getDepositAddress(
    symbol: string,
    chain: string,
  ): Promise<DepositAddress> {
    this.logger.log(`[GetDepositAddress] Requesting deposit address...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);

    try {
      // Get token info from inventory
      const key = `${symbol}:${chain}`;
      const tokenInfo = this.tokenMapping.get(key);

      if (!tokenInfo) {
        throw new Error(
          `Token ${symbol} not found on chain ${chain}`,
        );
      }

      const network = tokenInfo.get('network');
      const address = tokenInfo.get('address');
      const decimals = tokenInfo.get('decimals');

      // Call Chaindefuser RPC
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'get_deposit_address',
        params: {
          network: network,
          asset: address === 'native' ? 'native' : address,
          chain_name: chain,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const depositData = response.data.result;

      this.logger.log(`[GetDepositAddress] ✅ Deposit address obtained`);
      this.logger.log(`  Address: ${depositData.address}`);
      this.logger.log(`  Min Deposit: ${depositData.min_deposit}`);

      return {
        address: depositData.address,
        network: network,
        asset: `${symbol}:${chain}`,
        minDeposit: depositData.min_deposit,
        maxDeposit: depositData.max_deposit,
      };
    } catch (error) {
      this.logger.error(`[GetDepositAddress] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get recent deposits for solver account
   * Calls Chaindefuser RPC: get_recent_deposits
   */
  async getRecentDeposits(
    address: string,
    limit: number = 10,
  ): Promise<RecentDeposit[]> {
    this.logger.log(`[GetRecentDeposits] Querying recent deposits...`);
    this.logger.log(`  Address: ${address}`);
    this.logger.log(`  Limit: ${limit}`);

    try {
      // Call Chaindefuser RPC
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'get_recent_deposits',
        params: {
          address: address,
          limit: limit,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const deposits: RecentDeposit[] = response.data.result.deposits.map(
        (deposit: any) => ({
          txHash: deposit.tx_hash,
          network: deposit.network,
          asset: deposit.asset,
          amount: deposit.amount,
          timestamp: deposit.timestamp,
          status: deposit.status,
        }),
      );

      this.logger.log(
        `[GetRecentDeposits] ✅ Retrieved ${deposits.length} deposits`,
      );
      return deposits;
    } catch (error) {
      this.logger.error(`[GetRecentDeposits] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Get withdrawal status
   * Calls Chaindefuser RPC: get_withdrawal_status
   */
  async getWithdrawalStatus(
    withdrawalId: string,
  ): Promise<WithdrawalStatus> {
    this.logger.log(`[GetWithdrawalStatus] Querying withdrawal status...`);
    this.logger.log(`  Withdrawal ID: ${withdrawalId}`);

    try {
      // Call Chaindefuser RPC
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'get_withdrawal_status',
        params: {
          withdrawal_id: withdrawalId,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const status = response.data.result;

      this.logger.log(
        `[GetWithdrawalStatus] ✅ Status: ${status.status}`,
      );

      return {
        withdrawalId: status.withdrawal_id,
        txHash: status.tx_hash,
        network: status.network,
        asset: status.asset,
        amount: status.amount,
        status: status.status,
        estimatedTime: status.estimated_time,
      };
    } catch (error) {
      this.logger.error(`[GetWithdrawalStatus] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Notify service about deposit transaction
   * Calls Chaindefuser RPC: notify_deposit
   */
  async notifyDeposit(
    txHash: string,
    chain: string,
    symbol: string,
    amount: string,
  ): Promise<{ status: string; message: string }> {
    this.logger.log(`[NotifyDeposit] Notifying deposit...`);
    this.logger.log(`  TX Hash: ${txHash}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      // Get token info from inventory
      const key = `${symbol}:${chain}`;
      const tokenInfo = this.tokenMapping.get(key);

      if (!tokenInfo) {
        throw new Error(
          `Token ${symbol} not found on chain ${chain}`,
        );
      }

      const network = tokenInfo.get('network');
      const address = tokenInfo.get('address');

      // Call Chaindefuser RPC
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'notify_deposit',
        params: {
          tx_hash: txHash,
          network: network,
          asset: address === 'native' ? 'native' : address,
          amount: amount,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const result = response.data.result;

      this.logger.log(
        `[NotifyDeposit] ✅ Notification sent: ${result.status}`,
      );

      return {
        status: result.status,
        message: result.message || 'Notification sent successfully',
      };
    } catch (error) {
      this.logger.error(`[NotifyDeposit] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Estimate withdrawal fees
   * Calls Chaindefuser RPC: estimate_withdrawal_fee
   */
  async estimateWithdrawalFee(
    symbol: string,
    chain: string,
    amount: string,
  ): Promise<WithdrawalFeeEstimate> {
    this.logger.log(`[EstimateWithdrawalFee] Estimating withdrawal fee...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      // Get token info from inventory
      const key = `${symbol}:${chain}`;
      const tokenInfo = this.tokenMapping.get(key);

      if (!tokenInfo) {
        throw new Error(
          `Token ${symbol} not found on chain ${chain}`,
        );
      }

      const network = tokenInfo.get('network');
      const address = tokenInfo.get('address');

      // Call Chaindefuser RPC
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'estimate_withdrawal_fee',
        params: {
          network: network,
          asset: address === 'native' ? 'native' : address,
          amount: amount,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const fee = response.data.result;

      this.logger.log(`[EstimateWithdrawalFee] ✅ Fee estimated`);
      this.logger.log(`  Fee: ${fee.fee}`);
      this.logger.log(`  Total: ${fee.total}`);

      return {
        asset: `${symbol}:${chain}`,
        network: network,
        amount: amount,
        fee: fee.fee,
        feePercentage: fee.fee_percentage,
        total: fee.total,
        estimatedTime: fee.estimated_time,
      };
    } catch (error) {
      this.logger.error(`[EstimateWithdrawalFee] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Withdraw funds via Chaindefuser bridge
   * Uses estimate_fee and initiates withdrawal
   */
  async withdrawFunds(
    symbol: string,
    chain: string,
    amount: string,
    recipientAddress: string,
  ): Promise<{
    status: string;
    withdrawalId: string;
    txHash: string;
    fee: string;
    total: string;
    estimatedTime: number;
  }> {
    this.logger.log(`[WithdrawFunds] Initiating withdrawal...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);
    this.logger.log(`  Recipient: ${recipientAddress}`);

    try {
      // Get token info from inventory
      const key = `${symbol}:${chain}`;
      const tokenInfo = this.tokenMapping.get(key);

      if (!tokenInfo) {
        throw new Error(
          `Token ${symbol} not found on chain ${chain}`,
        );
      }

      const network = tokenInfo.get('network');
      const address = tokenInfo.get('address');

      // First, estimate the fee
      const feeEstimate = await this.estimateWithdrawalFee(
        symbol,
        chain,
        amount,
      );

      this.logger.log(`[WithdrawFunds] Fee estimated: ${feeEstimate.fee}`);

      // Call Chaindefuser RPC to initiate withdrawal
      const response = await this.httpClient.post('', {
        jsonrpc: '2.0',
        id: 1,
        method: 'withdraw',
        params: {
          network: network,
          asset: address === 'native' ? 'native' : address,
          amount: amount,
          recipient_address: recipientAddress,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      const result = response.data.result;

      this.logger.log(`[WithdrawFunds] ✅ Withdrawal initiated`);
      this.logger.log(`  Withdrawal ID: ${result.withdrawal_id}`);
      this.logger.log(`  TX Hash: ${result.tx_hash}`);

      return {
        status: 'initiated',
        withdrawalId: result.withdrawal_id,
        txHash: result.tx_hash,
        fee: feeEstimate.fee,
        total: feeEstimate.total,
        estimatedTime: feeEstimate.estimatedTime,
      };
    } catch (error) {
      this.logger.error(`[WithdrawFunds] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Deposit funds via Chaindefuser bridge
   * Gets deposit address and returns for user to send funds
   */
  async depositFunds(
    symbol: string,
    chain: string,
    amount: string,
  ): Promise<{
    status: string;
    depositAddress: string;
    network: string;
    asset: string;
    amount: string;
    minDeposit: string;
    maxDeposit?: string;
    instructions: string;
  }> {
    this.logger.log(`[DepositFunds] Preparing deposit...`);
    this.logger.log(`  Symbol: ${symbol}`);
    this.logger.log(`  Chain: ${chain}`);
    this.logger.log(`  Amount: ${amount}`);

    try {
      // Get deposit address
      const depositAddress = await this.getDepositAddress(symbol, chain);

      // Validate amount
      if (BigInt(amount) < BigInt(depositAddress.minDeposit)) {
        throw new Error(
          `Amount ${amount} is below minimum deposit ${depositAddress.minDeposit}`,
        );
      }

      if (
        depositAddress.maxDeposit &&
        BigInt(amount) > BigInt(depositAddress.maxDeposit)
      ) {
        throw new Error(
          `Amount ${amount} exceeds maximum deposit ${depositAddress.maxDeposit}`,
        );
      }

      this.logger.log(`[DepositFunds] ✅ Deposit details prepared`);

      return {
        status: 'ready',
        depositAddress: depositAddress.address,
        network: depositAddress.network,
        asset: depositAddress.asset,
        amount: amount,
        minDeposit: depositAddress.minDeposit,
        maxDeposit: depositAddress.maxDeposit,
        instructions: `Send ${amount} of ${symbol} to ${depositAddress.address} on ${chain}. Transaction will be automatically detected.`,
      };
    } catch (error) {
      this.logger.error(`[DepositFunds] Failed: ${error}`);
      throw error;
    }
  }

  /**
   * Check if token is supported
   */
  isTokenSupported(symbol: string, chain: string): boolean {
    const key = `${symbol}:${chain}`;
    return this.tokenMapping.has(key);
  }

  /**
   * Get all supported tokens for a specific chain
   */
  getChainTokens(chain: string): Array<{
    symbol: string;
    address: string;
    decimals: number;
  }> {
    const tokens: Array<{
      symbol: string;
      address: string;
      decimals: number;
    }> = [];

    for (const [key, tokenInfo] of this.tokenMapping.entries()) {
      if (key.endsWith(`:${chain}`)) {
        tokens.push({
          symbol: key.split(':')[0],
          address: tokenInfo.get('address'),
          decimals: tokenInfo.get('decimals'),
        });
      }
    }

    return tokens;
  }
}
