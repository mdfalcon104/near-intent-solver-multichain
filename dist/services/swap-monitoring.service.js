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
exports.SwapMonitoringService = void 0;
const common_1 = require("@nestjs/common");
const oneclick_service_1 = require("./oneclick.service");
let SwapMonitoringService = class SwapMonitoringService {
    constructor(oneClick) {
        this.oneClick = oneClick;
        this.swaps = new Map();
        this.monitoringIntervals = new Map();
    }
    registerSwap(depositAddress, params) {
        const record = {
            depositAddress,
            depositMemo: params.depositMemo,
            intentId: params.intentId,
            status: 'PENDING_DEPOSIT',
            originChain: params.originChain,
            destinationChain: params.destinationChain,
            amount: params.amount,
            recipient: params.recipient,
            createdAt: new Date(),
            updatedAt: new Date(),
            depositTxHash: params.depositTxHash,
        };
        this.swaps.set(depositAddress, record);
        this.startMonitoring(depositAddress, params.depositMemo);
    }
    startMonitoring(depositAddress, depositMemo) {
        if (this.monitoringIntervals.has(depositAddress)) {
            return;
        }
        const interval = setInterval(async () => {
            try {
                await this.updateSwapStatus(depositAddress, depositMemo);
            }
            catch (error) {
                console.error(`Error monitoring swap ${depositAddress}:`, error);
            }
        }, 10000);
        this.monitoringIntervals.set(depositAddress, interval);
        setTimeout(() => {
            this.stopMonitoring(depositAddress);
        }, 3600000);
    }
    async updateSwapStatus(depositAddress, depositMemo) {
        const record = this.swaps.get(depositAddress);
        if (!record) {
            return;
        }
        try {
            const status = await this.oneClick.getSwapStatus(depositAddress, depositMemo);
            record.status = status.status;
            record.updatedAt = new Date();
            if (status.swapDetails) {
                if (status.swapDetails.destinationChainTxHashes?.[0]) {
                    record.finalTxHash = status.swapDetails.destinationChainTxHashes[0].hash;
                }
            }
            if (['SUCCESS', 'FAILED', 'REFUNDED'].includes(status.status)) {
                record.completedAt = new Date();
                this.stopMonitoring(depositAddress);
                console.log(`Swap ${depositAddress} completed with status: ${status.status}`);
            }
            this.swaps.set(depositAddress, record);
        }
        catch (error) {
            record.error = String(error);
            record.updatedAt = new Date();
            this.swaps.set(depositAddress, record);
        }
    }
    stopMonitoring(depositAddress) {
        const interval = this.monitoringIntervals.get(depositAddress);
        if (interval) {
            clearInterval(interval);
            this.monitoringIntervals.delete(depositAddress);
        }
    }
    getSwap(depositAddress) {
        return this.swaps.get(depositAddress);
    }
    getSwapByIntentId(intentId) {
        return Array.from(this.swaps.values()).find(swap => swap.intentId === intentId);
    }
    getActiveSwaps() {
        return Array.from(this.swaps.values()).filter(swap => !['SUCCESS', 'FAILED', 'REFUNDED'].includes(swap.status));
    }
    getAllSwaps() {
        return Array.from(this.swaps.values());
    }
    getSwapsByStatus(status) {
        return Array.from(this.swaps.values()).filter(swap => swap.status === status);
    }
    cleanup(olderThanMs = 86400000) {
        const cutoffTime = Date.now() - olderThanMs;
        for (const [depositAddress, record] of this.swaps.entries()) {
            if (record.completedAt &&
                record.completedAt.getTime() < cutoffTime) {
                this.swaps.delete(depositAddress);
                this.stopMonitoring(depositAddress);
            }
        }
    }
    async refreshSwapStatus(depositAddress, depositMemo) {
        await this.updateSwapStatus(depositAddress, depositMemo);
        return this.getSwap(depositAddress) || null;
    }
};
exports.SwapMonitoringService = SwapMonitoringService;
exports.SwapMonitoringService = SwapMonitoringService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oneclick_service_1.OneClickService])
], SwapMonitoringService);
//# sourceMappingURL=swap-monitoring.service.js.map