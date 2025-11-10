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
exports.QuoteController = void 0;
const common_1 = require("@nestjs/common");
const pricing_service_1 = require("../services/pricing.service");
const oneclick_service_1 = require("../services/oneclick.service");
let QuoteController = class QuoteController {
    constructor(pricingService, oneClick) {
        this.pricingService = pricingService;
        this.oneClick = oneClick;
    }
    async quote(req) {
        const quotes = await this.pricingService.computeQuotes(req);
        return { quotes };
    }
    async crossChainQuote(req) {
        try {
            const quote = await this.pricingService.getCrossChainQuote({
                originAsset: req.originAsset,
                destinationAsset: req.destinationAsset,
                amount: req.amount,
                slippageTolerance: req.slippageTolerance,
            });
            return quote;
        }
        catch (error) {
            return {
                status: 'failed',
                error: String(error),
            };
        }
    }
    async getSupportedTokens() {
        try {
            const tokens = await this.oneClick.getSupportedTokens();
            return {
                status: 'ok',
                tokens,
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
exports.QuoteController = QuoteController;
__decorate([
    (0, common_1.Post)('quote'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "quote", null);
__decorate([
    (0, common_1.Post)('quote/cross-chain'),
    (0, common_1.HttpCode)(200),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "crossChainQuote", null);
__decorate([
    (0, common_1.Get)('tokens/supported'),
    (0, common_1.HttpCode)(200),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], QuoteController.prototype, "getSupportedTokens", null);
exports.QuoteController = QuoteController = __decorate([
    (0, common_1.Controller)(),
    __metadata("design:paramtypes", [pricing_service_1.PricingService,
        oneclick_service_1.OneClickService])
], QuoteController);
//# sourceMappingURL=quote.controller.js.map