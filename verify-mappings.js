const inventory = require('./inventory.json');

console.log('Missing token mappings added:\n');
const tokens = inventory.chains.near.tokens;
const newTokens = tokens.slice(3); // Show the newly added ones

newTokens.forEach(token => {
  if (token.address_price) {
    console.log(`✅ ${token.address}`);
    console.log(`   Symbol: ${token.symbol}, ChainId: ${token.chainId_price}, Price Address: ${token.address_price}\n`);
  }
});
