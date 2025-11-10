import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import WebSocket from 'ws';
import { PricingService } from './pricing.service';
import { SimplePricingService } from './simple-pricing.service';
import { Nep413SignerService } from './nep413-signer.service';
import { InventoryService } from './inventory.service';
import { TransferExecutorService } from './transfer-executor.service';

interface QuoteRequestParams {
  subscription: string;
  quote_id: string;
  defuse_asset_identifier_in: string;
  defuse_asset_identifier_out: string;
  exact_amount_in?: string;
  exact_amount_out?: string;
  min_deadline_ms: number;
}

interface QuoteStatusParams {
  subscription: string;
  quote_id: string;
  status: 'pending' | 'filled' | 'expired' | 'cancelled';
}

interface QuoteMetadata {
  quoteId: string;
  originAsset: string;
  destAsset: string;
  amountOut: string;
  createdAt: number;
}

@Injectable()
export class SolverBusService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SolverBusService.name);
  private ws: WebSocket | null = null;
  private readonly wsUrl: string;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private readonly reconnectDelay = 5000; // 5 seconds
  private isEnabled: boolean;
  private readonly simulationMode: boolean;
  private activeQuotes: Map<string, QuoteMetadata> = new Map();

  constructor(
    private readonly configService: ConfigService,
    private readonly pricingService: PricingService,
    private readonly simplePricingService: SimplePricingService,
    private readonly nep413Signer: Nep413SignerService,
    private readonly inventoryService: InventoryService,
    private readonly transferExecutor: TransferExecutorService,
  ) {
    this.wsUrl =
      this.configService.get('SOLVER_BUS_WS_URL') ||
      'wss://solver-relay-v2.chaindefuser.com/ws';
    this.isEnabled = this.configService.get('SOLVER_BUS_ENABLED') === 'true';
    this.simulationMode = this.configService.get('SOLVER_BUS_SIMULATION') === 'true';
    
    if (this.simulationMode) {
      this.logger.warn('🧪 SIMULATION MODE ENABLED - Quotes will NOT be sent to Solver Bus');
    }
  }

  async onModuleInit() {
    if (this.isEnabled) {
      this.logger.log('Solver Bus enabled, connecting to WebSocket...');
      this.connect();
    } else {
      this.logger.log('Solver Bus is disabled. Set SOLVER_BUS_ENABLED=true to enable');
    }
  }

  async onModuleDestroy() {
    this.disconnect();
  }

  /**
   * Connect to Solver Bus WebSocket
   */
  private connect() {
    try {
      this.logger.log(`Connecting to Solver Bus at ${this.wsUrl}`);
      this.ws = new WebSocket(this.wsUrl);

      this.ws.on('open', () => {
        this.logger.log('✅ Connected to Solver Bus WebSocket');
        this.subscribeToQuoteRequests();
      });

      this.ws.on('message', (data: WebSocket.Data) => {
        this.handleMessage(data.toString());
      });

      this.ws.on('error', (error) => {
        this.logger.error('WebSocket error:', error.message);
      });

      this.ws.on('close', () => {
        this.logger.warn('WebSocket connection closed. Reconnecting...');
        this.scheduleReconnect();
      });
    } catch (error) {
      this.logger.error('Failed to connect to Solver Bus:', error);
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  private disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect() {
    if (this.reconnectTimeout) {
      return; // Already scheduled
    }

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.connect();
    }, this.reconnectDelay);
  }

  /**
   * Subscribe to quote requests
   */
  private subscribeToQuoteRequests() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.logger.warn('Cannot subscribe: WebSocket not connected');
      return;
    }

    // Subscribe to "quote" events (not "quote_request")
    const subscribeQuoteMessage = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'subscribe',
      params: ['quote'],
    };

    this.ws.send(JSON.stringify(subscribeQuoteMessage));
    this.logger.log('Subscribed to quote events');

    // Also subscribe to "quote_status" events
    const subscribeStatusMessage = {
      jsonrpc: '2.0',
      id: Date.now() + 1,
      method: 'subscribe',
      params: ['quote_status'],
    };

    this.ws.send(JSON.stringify(subscribeStatusMessage));
    this.logger.log('Subscribed to quote_status events');
  }

  /**
   * Handle incoming WebSocket messages
   */
  private async handleMessage(data: string) {
    try {
      const message = JSON.parse(data);

      // Handle subscription events
      if (message.method === 'event' && message.params) {
        const { subscription, data: eventData } = message.params;
        
        // Quote request event
        if (eventData.quote_id && eventData.defuse_asset_identifier_in) {
          await this.handleQuoteRequest({
            subscription,
            ...eventData,
          });
        }
        // Quote status event
        else if (eventData.status) {
          this.handleQuoteStatus({
            subscription,
            ...eventData,
          });
        }
      } 
      // Handle RPC responses (subscription confirmations, etc)
      else if (message.result !== undefined) {
        this.logger.log('Subscription confirmed:', message.result);
      } 
      // Handle errors
      else if (message.error) {
        this.logger.error('WebSocket error:', message.error);
      }
      else {
        this.logger.debug('Received unknown message:', message);
      }
    } catch (error) {
      this.logger.error('Failed to handle message:', error);
    }
  }

  /**
   * Handle quote request from Solver Bus
   */
  private async handleQuoteRequest(params: QuoteRequestParams) {
    const { quote_id, subscription, ...quoteParams } = params;

    this.logger.log(
      `[Quote Request] ID: ${quote_id}, In: ${quoteParams.defuse_asset_identifier_in}, Out: ${quoteParams.defuse_asset_identifier_out}`,
    );
    this.logger.log(`[Quote Request] Amount: ${quoteParams.exact_amount_in || quoteParams.exact_amount_out}`);

    try {
      this.logger.log(`[Quote Request] Calculating quote from inventory...`);
      const quoteResult = await this.simplePricingService.calculateQuote({
        originAsset: quoteParams.defuse_asset_identifier_in,
        destinationAsset: quoteParams.defuse_asset_identifier_out,
        amount: quoteParams.exact_amount_in || quoteParams.exact_amount_out || '0',
      });

      // Skip quote if no price mapping available for tokens
      if (!quoteResult) {
        this.logger.warn(
          `[Quote Request] ⏭️ Skipping quote ${quote_id} - no price mapping for tokens`,
        );
        return;
      }

      this.logger.log(
        `[Quote Request] Quote calculated: ${quoteResult.amountOut} (rate: ${quoteResult.rate.toFixed(6)})`,
      );

      // Check if we have inventory to fulfill this quote
      const canFulfill = this.inventoryService.canProvideQuote(
        quoteParams.defuse_asset_identifier_in,
        quoteParams.defuse_asset_identifier_out,
        quoteResult.amountOut,
      );

      if (!canFulfill) {
        this.logger.warn(`[Quote Request] ⚠️ Insufficient inventory for ${quote_id} - SKIPPING`);
        return;
      }

      this.logger.log(`[Quote Request] ✅ Inventory check passed`);

      // Reserve inventory
      this.inventoryService.reserveInventory(
        quote_id,
        quoteParams.defuse_asset_identifier_out,
        quoteResult.amountOut,
      );

      // Store quote metadata for later transfer execution
      this.activeQuotes.set(quote_id, {
        quoteId: quote_id,
        originAsset: quoteParams.defuse_asset_identifier_in,
        destAsset: quoteParams.defuse_asset_identifier_out,
        amountOut: quoteResult.amountOut,
        createdAt: Date.now(),
      });

      this.logger.log(`[Quote Request] Creating NEP-413 signed quote...`);
      const signedQuote = await this.nep413Signer.createSignedQuote(
        quote_id,
        quoteParams,
        quoteResult.amountOut,
      );
      this.logger.log(`[Quote Request] Quote signed successfully`);

      // Send quote response
      if (this.simulationMode) {
        this.logger.warn(`[SIMULATION] Would send quote response for ${quote_id}`);
        this.logger.warn(`[SIMULATION] Quote output: ${JSON.stringify(signedQuote.quote_output, null, 2)}`);
        this.logger.warn(`[SIMULATION] Signed data preview: signature=${signedQuote.signed_data.signature.substring(0, 30)}...`);
        this.logger.log(`🧪 SIMULATION - Quote NOT sent to Solver Bus`);
      } else {
        this.logger.log(`[Quote Request] Sending quote response to Solver Bus...`);
        await this.sendQuoteResponse(signedQuote);
        this.logger.log(`✅ Sent quote response for ${quote_id}`);
      }
    } catch (error) {
      this.logger.error(`❌ Failed to handle quote request ${quote_id}:`, error.message);
      this.logger.error(error.stack);
    }
  }

  /**
   * Handle quote status updates
   */
  private async handleQuoteStatus(params: QuoteStatusParams) {
    const { quote_id, status } = params;
    this.logger.log(`[Quote Status] ${quote_id}: ${status}`);

    const quoteMetadata = this.activeQuotes.get(quote_id);

    if (!quoteMetadata) {
      this.logger.warn(`[Quote Status] No metadata found for quote ${quote_id}`);
      return;
    }

    // Handle filled quote
    if (status === 'filled') {
      this.logger.log(`🎉 Quote ${quote_id} was filled! Executing transfer...`);
      
      try {
        // Parse destination asset to get chain and token address
        const [destChain, destToken] = quoteMetadata.destAsset.split(':');
        
        this.logger.log(`[Quote Status] Transfer Details:`);
        this.logger.log(`  Chain: ${destChain}`);
        this.logger.log(`  Token: ${destToken}`);
        this.logger.log(`  Amount: ${quoteMetadata.amountOut}`);

        // Check if we have transfer executor configured for this chain
        if (!this.transferExecutor.isChainConfigured(destChain)) {
          this.logger.warn(`⚠️  Transfer executor not configured for ${destChain} - SKIPPING TRANSFER`);
          this.activeQuotes.delete(quote_id);
          return;
        }

        // In production, get recipient address from quote metadata or config
        // For now, we'll skip actual transfer execution (would need recipient address)
        this.logger.log(`[Quote Status] Transfer execution pending (requires recipient address from NEAR Intents)`);
        
        // Mark as ready for transfer
        this.activeQuotes.delete(quote_id);
      } catch (error) {
        this.logger.error(`[Quote Status] ❌ Error processing filled quote: ${error.message}`);
      }
    }
    // Handle expired quote
    else if (status === 'expired' || status === 'cancelled') {
      this.logger.log(`[Quote Status] Quote ${quote_id} ${status} - releasing inventory`);
      this.inventoryService.releaseInventory(quote_id, quoteMetadata.destAsset, quoteMetadata.amountOut);
      this.activeQuotes.delete(quote_id);
    }
  }

  /**
   * Send quote response to Solver Bus
   */
  private async sendQuoteResponse(signedQuote: any) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }

    const responseMessage = {
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'respond_quote',
      params: signedQuote,
    };

    this.ws.send(JSON.stringify(responseMessage));
  }

  /**
   * Get WebSocket connection status
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      connected: this.ws?.readyState === WebSocket.OPEN,
      url: this.wsUrl,
    };
  }

  /**
   * Manually trigger reconnection
   */
  reconnect() {
    this.logger.log('Manual reconnection triggered');
    this.disconnect();
    this.connect();
  }
}
