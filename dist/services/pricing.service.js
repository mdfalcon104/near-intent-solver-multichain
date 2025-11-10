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
exports.PricingService = void 0;
const common_1 = require("@nestjs/common");
const oneclick_service_1 = require("./oneclick.service");
let PricingService = class PricingService {
    constructor(oneClick) {
        this.oneClick = oneClick;
    }
    async computeQuotes(req) {
        try {
            const originAsset = req.originAsset || req.defuse_asset_identifier_in;
            const destinationAsset = req.destinationAsset || req.defuse_asset_identifier_out;
            const amount = req.amount || req.exact_amount_in || req.amount_in;
            const slippageTolerance = req.slippageTolerance || 100;
            if (!originAsset || !destinationAsset || !amount) {
                return [];
            }
            const oneClickQuote = await this.oneClick.getQuoteEstimate({
                originAsset,
                destinationAsset,
                amount: amount.toString(),
                slippageTolerance,
            });
            const markup = Number(process.env.MARKUP_PCT || 0.005);
            const ttl = Number(process.env.QUOTE_TTL_MS || 5000);
            const baseAmountOut = Number(oneClickQuote.quote.amountOut);
            const amountOutWithMarkup = Math.floor(baseAmountOut * (1 - markup));
            const quoteId = `quote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            return [
                {
                    quote_id: quoteId,
                    solver_id: process.env.SOLVER_ID || 'market-maker-solver',
                    amount_in: oneClickQuote.quote.amountIn,
                    amount_out: amountOutWithMarkup.toString(),
                    ttl_ms: ttl,
                    metadata: {
                        originAsset,
                        destinationAsset,
                        oneClickAmountOut: oneClickQuote.quote.amountOut,
                        marketMakerAmountOut: amountOutWithMarkup.toString(),
                        markup: markup,
                        timeEstimate: oneClickQuote.quote.timeEstimate,
                        amountInUsd: oneClickQuote.quote.amountInUsd,
                        amountOutUsd: oneClickQuote.quote.amountOutUsd,
                    },
                },
            ];
        }
        catch (error) {
            console.error('Failed to compute quotes:', error);
            return [];
        }
    }
    async getCrossChainQuote(params) {
        try {
            const quote = await this.oneClick.getQuoteEstimate(params);
            const markup = Number(process.env.MARKUP_PCT || 0.005);
            const baseAmountOut = Number(quote.quote.amountOut);
            const amountOutWithMarkup = Math.floor(baseAmountOut * (1 - markup));
            return {
                status: 'ok',
                quote: {
                    quoteId: `quote_${Date.now()}`,
                    amountIn: quote.quote.amountIn,
                    amountInFormatted: quote.quote.amountInFormatted,
                    amountInUsd: quote.quote.amountInUsd,
                    amountOut: amountOutWithMarkup.toString(),
                    amountOutFormatted: (Number(quote.quote.amountOutFormatted) * (1 - markup)).toFixed(6),
                    baseAmountOut: quote.quote.amountOut,
                    baseAmountOutFormatted: quote.quote.amountOutFormatted,
                    amountOutUsd: quote.quote.amountOutUsd,
                    minAmountOut: quote.quote.minAmountOut,
                    timeEstimate: quote.quote.timeEstimate,
                    deadline: quote.quote.deadline,
                    markup: markup,
                    marketMakerFee: (baseAmountOut * markup).toString(),
                },
                timestamp: quote.timestamp,
            };
        }
        catch (error) {
            throw error;
        }
    }
};
exports.PricingService = PricingService;
exports.PricingService = PricingService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [oneclick_service_1.OneClickService])
], PricingService);
//# sourceMappingURL=pricing.service.js.map