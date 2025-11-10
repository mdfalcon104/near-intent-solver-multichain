export function estimateAmmSlippage(amountIn:number, reserveIn:number, reserveOut:number) {
  // constant product AMM: x * y = k
  // price impact approx: amountIn / (reserveIn + amountIn)
  if (reserveIn <= 0) return 0.01;
  const impact = amountIn / (reserveIn + amountIn);
  return Math.min(impact, 0.5); // cap
}
