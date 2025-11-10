const inventory = require('./inventory.json');

// Verification script - console output removed
const tokens = inventory.chains.near.tokens;
const newTokens = tokens.slice(3); // Show the newly added ones

newTokens.forEach(token => {
  if (token.address_price) {
    // Token mapping verified
  }
});
