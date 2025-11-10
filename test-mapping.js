const inventory = require('./inventory.json');

let count = 0;
for (const [chain, config] of Object.entries(inventory.chains)) {
  if (config.tokens) {
    for (const token of config.tokens) {
      if (token.address_price && token.chainId_price) {
        console.log(`✅ ${chain}: ${token.symbol} (${token.address}) -> chainId=${token.chainId_price}, address=${token.address_price}`);
        count++;
      }
    }
  }
}
console.log(`\nTotal mappings: ${count}`);
