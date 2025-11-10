import { Module } from '@nestjs/common';
import { QuoteController } from './controllers/quote.controller';
import { ExecuteController } from './controllers/execute.controller';
import { SolverBusController } from './controllers/solver-bus.controller';
import { DepositWithdrawalController } from './controllers/deposit-withdrawal.controller';
import { InventoryController } from './controllers/inventory.controller';
import { PricingService } from './services/pricing.service';
import { SimplePricingService } from './services/simple-pricing.service';
import { ExecutionService } from './services/execution.service';
import { NearService } from './services/near.service';
import { EvmService } from './services/evm.service';
import { LockService } from './services/lock.service';
import { ConfigService } from './config/config.service';
import { OneClickService } from './services/oneclick.service';
import { ChainKeysService } from './services/chain-keys.service';
import { SwapMonitoringService } from './services/swap-monitoring.service';
import { SolverBusService } from './services/solver-bus.service';
import { Nep413SignerService } from './services/nep413-signer.service';
import { InventoryService } from './services/inventory.service';
import { DepositWithdrawalService } from './services/deposit-withdrawal.service';
import { ChaindefuserBridgeService } from './services/chaindefuser-bridge.service';

@Module({
  controllers: [QuoteController, ExecuteController, SolverBusController, DepositWithdrawalController, InventoryController],
  providers: [
    ConfigService,
    EvmService,
    NearService,
    ExecutionService,
    PricingService,
    SimplePricingService,
    LockService,
    OneClickService,
    ChainKeysService,
    SwapMonitoringService,
    SolverBusService,
    Nep413SignerService,
    InventoryService,
    DepositWithdrawalService,
    ChaindefuserBridgeService,
  ],
})
export class AppModule {}
