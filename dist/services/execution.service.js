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
exports.ExecutionService = void 0;
const common_1 = require("@nestjs/common");
const near_service_1 = require("./near.service");
const evm_service_1 = require("./evm.service");
const lock_service_1 = require("./lock.service");
const oneclick_service_1 = require("./oneclick.service");
const chain_keys_service_1 = require("./chain-keys.service");
let ExecutionService = class ExecutionService {
    constructor(near, evm, lock, oneClick, chainKeys) {
        this.near = near;
        this.evm = evm;
        this.lock = lock;
        this.oneClick = oneClick;
        this.chainKeys = chainKeys;
    }
    async handleCrossChainExecution(body) {
        const key = `intent:${body.intent_id}`;
        const locked = await this.lock.lock(key, 120000);
        if (!locked) {
            return { status: 'busy', message: 'Intent is already being processed' };
        }
        try {
            if (!this.chainKeys.isChainSupported(body.originChain)) {
                await this.lock.unlock(key);
                return {
                    status: 'failed',
                    reason: 'unsupported_origin_chain',
                    message: `Chain ${body.originChain} is not configured. Supported chains: ${this.chainKeys.getSupportedChains().join(', ')}`
                };
            }
            console.log(`[Market Maker] Executing cross-chain swap for intent ${body.intent_id}`);
            console.log(`[Market Maker] ${body.originChain} → ${body.destinationChain}`);
            console.log(`[Market Maker] Amount: ${body.amount}, Recipient: ${body.recipient}`);
            const result = await this.oneClick.executeCrossChainSwap({
                originChain: body.originChain,
                originAsset: body.originAsset,
                destinationChain: body.destinationChain,
                destinationAsset: body.destinationAsset,
                amount: body.amount,
                recipient: body.recipient,
                refundTo: body.refundTo || body.recipient,
                slippageTolerance: body.slippageTolerance || 100,
            });
            console.log(`[Market Maker] Funds sent to 1Click deposit address: ${result.quote.quote.depositAddress}`);
            console.log(`[Market Maker] Deposit TX hash: ${result.depositTxHash}`);
            this.monitorSwapInBackground(result.quote.quote.depositAddress, result.quote.quote.depositMemo, key, body.intent_id);
            return {
                status: 'processing',
                intent_id: body.intent_id,
                quote_id: body.quote_id,
                depositTxHash: result.depositTxHash,
                depositAddress: result.quote.quote.depositAddress,
                swapStatus: result.status.status,
                estimatedTime: result.quote.quote.timeEstimate,
                quote: {
                    amountIn: result.quote.quote.amountIn,
                    amountOut: result.quote.quote.amountOut,
                    deadline: result.quote.quote.deadline,
                },
                message: 'Market Maker has sent funds to 1Click. Cross-chain swap in progress.',
            };
        }
        catch (error) {
            await this.lock.unlock(key);
            console.error(`[Market Maker] Failed to execute swap:`, error);
            return {
                status: 'failed',
                error: String(error),
                message: 'Failed to execute cross-chain swap'
            };
        }
    }
    async monitorSwapInBackground(depositAddress, depositMemo, lockKey, intentId) {
        try {
            console.log(`[Market Maker] Monitoring swap for intent ${intentId}...`);
            const finalStatus = await this.oneClick.monitorSwap(depositAddress, depositMemo, 900000);
            console.log(`[Market Maker] Swap completed for intent ${intentId}`);
            console.log(`[Market Maker] Status: ${finalStatus.status}`);
            if (finalStatus.swapDetails) {
                console.log(`[Market Maker] Amount In: ${finalStatus.swapDetails.amountInFormatted}`);
                console.log(`[Market Maker] Amount Out: ${finalStatus.swapDetails.amountOutFormatted}`);
                if (finalStatus.swapDetails.destinationChainTxHashes?.length > 0) {
                    console.log(`[Market Maker] Destination TX: ${finalStatus.swapDetails.destinationChainTxHashes[0].hash}`);
                    console.log(`[Market Maker] Explorer: ${finalStatus.swapDetails.destinationChainTxHashes[0].explorerUrl}`);
                }
                if (finalStatus.status === 'REFUNDED' && finalStatus.swapDetails.refundedAmount) {
                    console.log(`[Market Maker] Refunded: ${finalStatus.swapDetails.refundedAmountFormatted}`);
                }
            }
        }
        catch (error) {
            console.error(`[Market Maker] Swap monitoring failed for intent ${intentId}:`, error);
        }
        finally {
            await this.lock.unlock(lockKey);
            console.log(`[Market Maker] Released lock for intent ${intentId}`);
        }
    }
    async handleExecution(body) {
        const key = `intent:${body.intent_id}`;
        const locked = await this.lock.lock(key, 30000);
        if (!locked)
            return { status: 'busy' };
        try {
            const chain = body.chain || 'near';
            if (chain === 'near') {
                const tx = await this.near.executeIntent('execute_intents', {
                    intents: [body.intent_payload],
                });
                await this.lock.unlock(key);
                return { status: 'ok', txHash: tx.transaction.hash };
            }
            else {
                if (body.rawTx) {
                    const sent = await this.evm.sendRawTx(chain, body.rawTx);
                    await this.lock.unlock(key);
                    return { status: 'ok', txHash: sent.hash };
                }
                await this.lock.unlock(key);
                return { status: 'failed', reason: 'no_evm_payload' };
            }
        }
        catch (e) {
            await this.lock.unlock(key);
            return { status: 'failed', error: String(e) };
        }
    }
    async getSwapStatus(depositAddress, depositMemo) {
        try {
            const status = await this.oneClick.getSwapStatus(depositAddress, depositMemo);
            return {
                status: 'ok',
                swapStatus: status.status,
                details: status.swapDetails,
                updatedAt: status.updatedAt,
            };
        }
        catch (error) {
            return {
                status: 'failed',
                error: String(error),
            };
        }
    }
};
exports.ExecutionService = ExecutionService;
exports.ExecutionService = ExecutionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [near_service_1.NearService,
        evm_service_1.EvmService,
        lock_service_1.LockService,
        oneclick_service_1.OneClickService,
        chain_keys_service_1.ChainKeysService])
], ExecutionService);
//# sourceMappingURL=execution.service.js.map