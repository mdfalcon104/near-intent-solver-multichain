"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.estimateAmmSlippage = estimateAmmSlippage;
function estimateAmmSlippage(amountIn, reserveIn, reserveOut) {
    if (reserveIn <= 0)
        return 0.01;
    const impact = amountIn / (reserveIn + amountIn);
    return Math.min(impact, 0.5);
}
//# sourceMappingURL=amm.util.js.map