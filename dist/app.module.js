"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const quote_controller_1 = require("./controllers/quote.controller");
const execute_controller_1 = require("./controllers/execute.controller");
const solver_bus_controller_1 = require("./controllers/solver-bus.controller");
const deposit_withdrawal_controller_1 = require("./controllers/deposit-withdrawal.controller");
const inventory_controller_1 = require("./controllers/inventory.controller");
const pricing_service_1 = require("./services/pricing.service");
const simple_pricing_service_1 = require("./services/simple-pricing.service");
const execution_service_1 = require("./services/execution.service");
const near_service_1 = require("./services/near.service");
const evm_service_1 = require("./services/evm.service");
const lock_service_1 = require("./services/lock.service");
const config_service_1 = require("./config/config.service");
const oneclick_service_1 = require("./services/oneclick.service");
const chain_keys_service_1 = require("./services/chain-keys.service");
const swap_monitoring_service_1 = require("./services/swap-monitoring.service");
const solver_bus_service_1 = require("./services/solver-bus.service");
const nep413_signer_service_1 = require("./services/nep413-signer.service");
const inventory_service_1 = require("./services/inventory.service");
const deposit_withdrawal_service_1 = require("./services/deposit-withdrawal.service");
const chaindefuser_bridge_service_1 = require("./services/chaindefuser-bridge.service");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        controllers: [quote_controller_1.QuoteController, execute_controller_1.ExecuteController, solver_bus_controller_1.SolverBusController, deposit_withdrawal_controller_1.DepositWithdrawalController, inventory_controller_1.InventoryController],
        providers: [
            config_service_1.ConfigService,
            evm_service_1.EvmService,
            near_service_1.NearService,
            execution_service_1.ExecutionService,
            pricing_service_1.PricingService,
            simple_pricing_service_1.SimplePricingService,
            lock_service_1.LockService,
            oneclick_service_1.OneClickService,
            chain_keys_service_1.ChainKeysService,
            swap_monitoring_service_1.SwapMonitoringService,
            solver_bus_service_1.SolverBusService,
            nep413_signer_service_1.Nep413SignerService,
            inventory_service_1.InventoryService,
            deposit_withdrawal_service_1.DepositWithdrawalService,
            chaindefuser_bridge_service_1.ChaindefuserBridgeService,
        ],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map