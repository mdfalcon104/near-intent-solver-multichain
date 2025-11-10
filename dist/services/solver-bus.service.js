"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
var SolverBusService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolverBusService = void 0;
const common_1 = require("@nestjs/common");
const config_service_1 = require("../config/config.service");
const ws_1 = __importDefault(require("ws"));
const pricing_service_1 = require("./pricing.service");
const simple_pricing_service_1 = require("./simple-pricing.service");
const nep413_signer_service_1 = require("./nep413-signer.service");
const inventory_service_1 = require("./inventory.service");
let SolverBusService = SolverBusService_1 = class SolverBusService {
    constructor(configService, pricingService, simplePricingService, nep413Signer, inventoryService) {
        this.configService = configService;
        this.pricingService = pricingService;
        this.simplePricingService = simplePricingService;
        this.nep413Signer = nep413Signer;
        this.inventoryService = inventoryService;
        this.logger = new common_1.Logger(SolverBusService_1.name);
        this.ws = null;
        this.reconnectTimeout = null;
        this.reconnectDelay = 5000;
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
        }
        else {
            this.logger.log('Solver Bus is disabled. Set SOLVER_BUS_ENABLED=true to enable');
        }
    }
    async onModuleDestroy() {
        this.disconnect();
    }
    connect() {
        try {
            this.logger.log(`Connecting to Solver Bus at ${this.wsUrl}`);
            this.ws = new ws_1.default(this.wsUrl);
            this.ws.on('open', () => {
                this.logger.log('✅ Connected to Solver Bus WebSocket');
                this.subscribeToQuoteRequests();
            });
            this.ws.on('message', (data) => {
                this.handleMessage(data.toString());
            });
            this.ws.on('error', (error) => {
                this.logger.error('WebSocket error:', error.message);
            });
            this.ws.on('close', () => {
                this.logger.warn('WebSocket connection closed. Reconnecting...');
                this.scheduleReconnect();
            });
        }
        catch (error) {
            this.logger.error('Failed to connect to Solver Bus:', error);
            this.scheduleReconnect();
        }
    }
    disconnect() {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }
    scheduleReconnect() {
        if (this.reconnectTimeout) {
            return;
        }
        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, this.reconnectDelay);
    }
    subscribeToQuoteRequests() {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
            this.logger.warn('Cannot subscribe: WebSocket not connected');
            return;
        }
        const subscribeQuoteMessage = {
            jsonrpc: '2.0',
            id: Date.now(),
            method: 'subscribe',
            params: ['quote'],
        };
        this.ws.send(JSON.stringify(subscribeQuoteMessage));
        this.logger.log('Subscribed to quote events');
        const subscribeStatusMessage = {
            jsonrpc: '2.0',
            id: Date.now() + 1,
            method: 'subscribe',
            params: ['quote_status'],
        };
        this.ws.send(JSON.stringify(subscribeStatusMessage));
        this.logger.log('Subscribed to quote_status events');
    }
    async handleMessage(data) {
        try {
            const message = JSON.parse(data);
            if (message.method === 'event' && message.params) {
                const { subscription, data: eventData } = message.params;
                if (eventData.quote_id && eventData.defuse_asset_identifier_in) {
                    await this.handleQuoteRequest({
                        subscription,
                        ...eventData,
                    });
                }
                else if (eventData.status) {
                    this.handleQuoteStatus({
                        subscription,
                        ...eventData,
                    });
                }
            }
            else if (message.result !== undefined) {
                this.logger.log('Subscription confirmed:', message.result);
            }
            else if (message.error) {
                this.logger.error('WebSocket error:', message.error);
            }
            else {
                this.logger.debug('Received unknown message:', message);
            }
        }
        catch (error) {
            this.logger.error('Failed to handle message:', error);
        }
    }
    async handleQuoteRequest(params) {
        const { quote_id, subscription, ...quoteParams } = params;
        this.logger.log(`[Quote Request] ID: ${quote_id}, In: ${quoteParams.defuse_asset_identifier_in}, Out: ${quoteParams.defuse_asset_identifier_out}`);
        this.logger.log(`[Quote Request] Amount: ${quoteParams.exact_amount_in || quoteParams.exact_amount_out}`);
        try {
            this.logger.log(`[Quote Request] Calculating quote from inventory...`);
            const quoteResult = await this.simplePricingService.calculateQuote({
                originAsset: quoteParams.defuse_asset_identifier_in,
                destinationAsset: quoteParams.defuse_asset_identifier_out,
                amount: quoteParams.exact_amount_in || quoteParams.exact_amount_out || '0',
            });
            if (!quoteResult) {
                this.logger.warn(`[Quote Request] ⏭️ Skipping quote ${quote_id} - no price mapping for tokens`);
                return;
            }
            this.logger.log(`[Quote Request] Quote calculated: ${quoteResult.amountOut} (rate: ${quoteResult.rate.toFixed(6)})`);
            const canFulfill = this.inventoryService.canProvideQuote(quoteParams.defuse_asset_identifier_in, quoteParams.defuse_asset_identifier_out, quoteResult.amountOut);
            if (!canFulfill) {
                this.logger.warn(`[Quote Request] ⚠️ Insufficient inventory for ${quote_id} - SKIPPING`);
                return;
            }
            this.logger.log(`[Quote Request] ✅ Inventory check passed`);
            this.inventoryService.reserveInventory(quote_id, quoteParams.defuse_asset_identifier_out, quoteResult.amountOut);
            this.logger.log(`[Quote Request] Creating NEP-413 signed quote...`);
            const signedQuote = await this.nep413Signer.createSignedQuote(quote_id, quoteParams, quoteResult.amountOut);
            this.logger.log(`[Quote Request] Quote signed successfully`);
            if (this.simulationMode) {
                this.logger.warn(`[SIMULATION] Would send quote response for ${quote_id}`);
                this.logger.warn(`[SIMULATION] Quote output: ${JSON.stringify(signedQuote.quote_output, null, 2)}`);
                this.logger.warn(`[SIMULATION] Signed data preview: signature=${signedQuote.signed_data.signature.substring(0, 30)}...`);
                this.logger.log(`🧪 SIMULATION - Quote NOT sent to Solver Bus`);
            }
            else {
                this.logger.log(`[Quote Request] Sending quote response to Solver Bus...`);
                await this.sendQuoteResponse(signedQuote);
                this.logger.log(`✅ Sent quote response for ${quote_id}`);
            }
        }
        catch (error) {
            this.logger.error(`❌ Failed to handle quote request ${quote_id}:`, error.message);
            this.logger.error(error.stack);
        }
    }
    handleQuoteStatus(params) {
        const { quote_id, status } = params;
        this.logger.log(`[Quote Status] ${quote_id}: ${status}`);
        if (status === 'filled') {
            this.logger.log(`🎉 Quote ${quote_id} was filled! Execute cross-chain swap.`);
        }
    }
    async sendQuoteResponse(signedQuote) {
        if (!this.ws || this.ws.readyState !== ws_1.default.OPEN) {
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
    getStatus() {
        return {
            enabled: this.isEnabled,
            connected: this.ws?.readyState === ws_1.default.OPEN,
            url: this.wsUrl,
        };
    }
    reconnect() {
        this.logger.log('Manual reconnection triggered');
        this.disconnect();
        this.connect();
    }
};
exports.SolverBusService = SolverBusService;
exports.SolverBusService = SolverBusService = SolverBusService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [config_service_1.ConfigService,
        pricing_service_1.PricingService,
        simple_pricing_service_1.SimplePricingService,
        nep413_signer_service_1.Nep413SignerService,
        inventory_service_1.InventoryService])
], SolverBusService);
//# sourceMappingURL=solver-bus.service.js.map