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
Object.defineProperty(exports, "__esModule", { value: true });
exports.SolverBusController = void 0;
const common_1 = require("@nestjs/common");
const solver_bus_service_1 = require("../services/solver-bus.service");
let SolverBusController = class SolverBusController {
    constructor(solverBus) {
        this.solverBus = solverBus;
    }
    async status() {
        const status = this.solverBus.getStatus();
        return {
            status: 'ok',
            ...status,
        };
    }
    async reconnect() {
        this.solverBus.reconnect();
        return {
            status: 'ok',
            message: 'WebSocket reconnection triggered',
        };
    }
};
exports.SolverBusController = SolverBusController;
__decorate([
    (0, common_1.Get)('status'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SolverBusController.prototype, "status", null);
__decorate([
    (0, common_1.Post)('reconnect'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], SolverBusController.prototype, "reconnect", null);
exports.SolverBusController = SolverBusController = __decorate([
    (0, common_1.Controller)('solver-bus'),
    __metadata("design:paramtypes", [solver_bus_service_1.SolverBusService])
], SolverBusController);
//# sourceMappingURL=solver-bus.controller.js.map