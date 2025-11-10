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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ExecuteController = void 0;
const common_1 = require("@nestjs/common");
const execution_service_1 = require("../services/execution.service");
let ExecuteController = class ExecuteController {
    constructor(execService) {
        this.execService = execService;
    }
    async execute(body) {
        const result = await this.execService.handleExecution(body);
        return result;
    }
    async executeCrossChain(body) {
        const result = await this.execService.handleCrossChainExecution(body);
        return result;
    }
    async getSwapStatus(depositAddress, depositMemo) {
        if (!depositAddress) {
            return {
                status: 'failed',
                error: 'depositAddress is required',
            };
        }
        const result = await this.execService.getSwapStatus(depositAddress, depositMemo);
        return result;
    }
};
exports.ExecuteController = ExecuteController;
__decorate([
    (0, common_1.Post)('execute'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExecuteController.prototype, "execute", null);
__decorate([
    (0, common_1.Post)('execute/cross-chain'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ExecuteController.prototype, "executeCrossChain", null);
__decorate([
    (0, common_1.Get)('swap/status'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Query)('depositAddress')),
    __param(1, (0, common_1.Query)('depositMemo')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String]),
    __metadata("design:returntype", Promise)
], ExecuteController.prototype, "getSwapStatus", null);
exports.ExecuteController = ExecuteController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [execution_service_1.ExecutionService])
], ExecuteController);
//# sourceMappingURL=execute.controller.js.map