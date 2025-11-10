import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '../config/config.service';
import { PricingService } from './pricing.service';
import { SimplePricingService } from './simple-pricing.service';
import { Nep413SignerService } from './nep413-signer.service';
import { InventoryService } from './inventory.service';
export declare class SolverBusService implements OnModuleInit, OnModuleDestroy {
    private readonly configService;
    private readonly pricingService;
    private readonly simplePricingService;
    private readonly nep413Signer;
    private readonly inventoryService;
    private readonly logger;
    private ws;
    private readonly wsUrl;
    private reconnectTimeout;
    private readonly reconnectDelay;
    private isEnabled;
    private readonly simulationMode;
    constructor(configService: ConfigService, pricingService: PricingService, simplePricingService: SimplePricingService, nep413Signer: Nep413SignerService, inventoryService: InventoryService);
    onModuleInit(): Promise<void>;
    onModuleDestroy(): Promise<void>;
    private connect;
    private disconnect;
    private scheduleReconnect;
    private subscribeToQuoteRequests;
    private handleMessage;
    private handleQuoteRequest;
    private handleQuoteStatus;
    private sendQuoteResponse;
    getStatus(): {
        enabled: boolean;
        connected: boolean;
        url: string;
    };
    reconnect(): void;
}
