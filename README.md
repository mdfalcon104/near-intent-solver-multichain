# NEAR Intent Solver - Inventory-Based Market Maker

This is an **Inventory-Based Market Maker** built with NestJS that provides cross-chain swap quotes using **direct token transfers** from pre-funded inventory. The system competes on NEAR Intents Solver Bus and earns profit from markup on real-time token prices.

## 🎯 What is This?

An **Automated Market Maker** that:
- ✅ **Competes on Solver Bus** - Auto-receives quote requests via WebSocket
- ✅ **Inventory-Based** - Uses pre-funded wallets per chain (no DEX, no 1Click)
- ✅ **Real-time Pricing** - Fetches prices from Binance API (primary) + OKX API (backup)
- ✅ **Direct Transfers** - Sends tokens directly from own inventory to users
- ✅ **Earns Markup** - Configurable profit margin (default 0.5%)

## �️ Architecture Overview

### Business Model: **Direct Inventory Transfer**

```
┌─────────────────────────────────────────────────────────────┐
│  1. Quote Request (via Solver Bus WebSocket)                │
│     User wants: Swap 1 ETH → USDT                           │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  2. Price Fetch (Binance → OKX → Fallback)                  │
│     ETH price: $3,500 (live from API)                       │
│     USDT price: $1.00                                        │
│     Rate: 3500 USDT per 1 ETH                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  3. Inventory Check (inventory.json)                        │
│     ✅ Ethereum USDT: 5000 available (min: 100)             │
│     ✅ Can provide: 3500 USDT                                │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  4. Quote Calculation (with markup)                         │
│     Amount out: 3,500 USDT × (1 + 0.5%) = 3,517.5 USDT     │
│     Reserve inventory: 3,517.5 USDT                          │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  5. NEP-413 Sign & Submit Quote                             │
│     Signed quote sent to Solver Bus                          │
│     Compete with other solvers                               │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  6. If Quote Accepted (status: "filled")                    │
│     → Execute transfer: Send USDT from Ethereum wallet       │
│     → Update inventory: -3,517.5 USDT                        │
│     → Receive ETH from user (future implementation)          │
└─────────────────────────────────────────────────────────────┘
```

### Key Differences from 1Click Model:

| Feature | This System | 1Click-based System |
|---------|-------------|---------------------|
| **Execution** | Direct token transfer | Via 1Click API routing |
| **Inventory** | Own wallets per chain | Relies on 1Click liquidity |
| **Pricing** | Binance/OKX real-time | 1Click + markup |
| **Speed** | Instant (single transfer) | Multi-hop (deposit → route → deliver) |
| **Chains** | Pre-funded chains only | Any 1Click-supported chain |
| **Risk** | Inventory risk + price risk | Execution risk only |
| **Profit** | Spread + markup | Markup only |

## 📋 Prerequisites

1. **Node.js 18+** and npm
2. **Redis** - For distributed locks (auto-falls back to in-memory if unavailable)
3. **Funded Wallets** - Private keys for each chain you want to support
4. **NEAR Account** - For NEP-413 quote signing
5. **Token Inventory** - Pre-funded tokens on supported chains

## 🔧 Setup

### 1. Clone and Install

```bash
npm install
```

### 2. Configure Environment

Copy the example environment file and configure your settings:

```bash
cp .env.example .env
```

**Important configurations in `.env`:**

```bash
# ===== SOLVER BUS CONFIGURATION =====
SOLVER_BUS_ENABLED=true
SOLVER_BUS_WS_URL=wss://solver-relay-v2.chaindefuser.com/ws
SOLVER_BUS_SIMULATION=false  # true = log only, false = send quotes

# ===== NEAR ACCOUNT (for NEP-413 signing) =====
NEAR_ACCOUNT_ID=your-solver.near
CHAIN_NEAR_PRIVATE_KEY=ed25519:your_near_private_key
CHAIN_NEAR_NETWORK_ID=mainnet
CHAIN_NEAR_RPC_URL=https://rpc.mainnet.near.org

# ===== PRICING CONFIGURATION =====
MARKUP_PCT=0.005  # 0.5% markup (profit margin)

# ===== INVENTORY CONFIGURATION =====
INVENTORY_CONFIG_PATH=./inventory.json  # Path to inventory config

# ===== CHAIN PRIVATE KEYS (for token transfers) =====
# Ethereum
CHAIN_ETHEREUM_PRIVATE_KEY=0x_your_ethereum_private_key
CHAIN_ETHEREUM_RPC_URL=https://mainnet.infura.io/v3/YOUR_INFURA_KEY

# Arbitrum
CHAIN_ARBITRUM_PRIVATE_KEY=0x_your_arbitrum_private_key
CHAIN_ARBITRUM_RPC_URL=https://arb1.arbitrum.io/rpc

# Bitcoin (for BTC transfers)
CHAIN_BITCOIN_PRIVATE_KEY=your_bitcoin_wif_private_key
CHAIN_BITCOIN_NETWORK=mainnet

# Add more chains as needed...

# ===== REDIS (optional - auto-fallback to in-memory) =====
REDIS_URL=redis://localhost:6379
```

### 3. Configure Inventory

Create `inventory.json` with your token holdings:

```json
{
  "chains": {
    "near": {
      "tokens": [
        {
          "address": "usdt.tether-token.near",
          "symbol": "USDT",
          "decimals": 6,
          "currentBalance": "1000000000",
          "minBalance": "100000000",
          "enabled": true
        },
        {
          "address": "wrap.near",
          "symbol": "wNEAR",
          "decimals": 24,
          "currentBalance": "500000000000000000000000",
          "minBalance": "50000000000000000000000",
          "enabled": true
        }
      ]
    },
    "ethereum": {
      "tokens": [
        {
          "address": "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48",
          "symbol": "USDC",
          "decimals": 6,
          "currentBalance": "100000000",
          "minBalance": "10000000",
          "enabled": true
        },
        {
          "address": "0xdac17f958d2ee523a2206206994597c13d831ec7",
          "symbol": "USDT",
          "decimals": 6,
          "currentBalance": "50000000",
          "minBalance": "10000000",
          "enabled": true
        }
      ]
    }
  }
}
```

### 4. Run the Solver

Development mode with hot-reload:

```bash
npm run start:dev
```

Production mode:

```bash
npm run build
npm start
```

Or with Docker Compose:

```bash
docker-compose up -d
```

## 📚 Monitoring & Management

### Check Solver Bus Status

```bash
curl http://localhost:8080/solver-bus/status
```

**Response:**
```json
{
  "connected": true,
  "subscriptions": ["quote", "quote_status"],
  "simulation": false,
  "quotesReceived": 42,
  "quotesProcessed": 38,
  "quotesFailed": 4
}
```

### Reconnect to Solver Bus

```bash
curl -X POST http://localhost:8080/solver-bus/reconnect
```

### View Current Inventory

Check your `inventory.json` file or implement an endpoint to view real-time balances.

## 🔄 How Quote Competition Works

### 1. **Quote Request Received** (via WebSocket)
```json
{
  "method": "event",
  "params": {
    "subscription": "quote",
    "data": {
      "quote_id": "abc-123",
      "origin_asset": "nep141:usdt.tether-token.near",
      "destination_asset": "nep141:eth-0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48.omft.near",
      "amount": "1000000000",
      "recipient": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"
    }
  }
}
```

### 2. **System Processing**
- ✅ Parse tokens from Defuse identifiers
- ✅ Fetch prices: Binance API → OKX API → Fallback
- ✅ Calculate amount out with markup
- ✅ Check inventory availability
- ✅ Reserve tokens in inventory
- ✅ Sign quote with NEP-413

### 3. **Quote Submission**
```json
{
  "method": "quote",
  "params": {
    "quote_id": "abc-123",
    "quote": {
      "amount_out": "995000",
      "message": "...",
      "nonce": "...",
      "recipient": "solver.near",
      "public_key": "ed25519:...",
      "signature": "ed25519:..."
    }
  }
}
```

### 4. **Quote Status Updates**
```json
{
  "method": "event",
  "params": {
    "subscription": "quote_status",
    "data": {
      "quote_id": "abc-123",
      "status": "filled",
      "amount_in": "1000000000",
      "amount_out": "995000"
    }
  }
}
```

### 5. **Execute Transfer** (if quote filled)
- Transfer tokens from inventory wallet
- Update inventory balances
- Log transaction details

## 🏗️ Core Architecture

### 🎯 Main Services

#### 1. **SolverBusService** (`src/services/solver-bus.service.ts`)
**Purpose:** WebSocket client for NEAR Intents Solver Relay

**Key Functions:**
- Connects to `wss://solver-relay-v2.chaindefuser.com/ws`
- Subscribes to `quote` and `quote_status` events
- Parses quote requests from WebSocket messages
- Coordinates quote calculation and submission
- Handles quote status updates (filled/rejected)

**Flow:**
```typescript
onMessage() → parseQuoteRequest() → calculateQuote() 
  → checkInventory() → signQuote() → submitQuote()
```

#### 2. **SimplePricingService** (`src/services/simple-pricing.service.ts`)
**Purpose:** Real-time token pricing with multiple sources

**Pricing Strategy (in order):**
1. **Cache** - Return if price cached within 60s
2. **Binance API** - Primary source (3s timeout)
   - `https://web3.binance.com/bapi/defi/v1/public/wallet-direct/buw/wallet/token/price/info`
3. **OKX API** - Backup source (3s timeout)
   - `https://web3.okx.com/priapi/v5/dex/token/market/dex-token-hlc-candles`
   - Uses latest candle close price
4. **Fallback Prices** - Static prices for stablecoins and major tokens

**Key Functions:**
```typescript
calculateQuote(originAsset, destinationAsset, amount)
  → getTokenPriceUsd() // Multi-source pricing
  → applyMarkup()      // Add profit margin
  → formatDecimals()   // Handle token decimals
```

#### 3. **InventoryService** (`src/services/inventory.service.ts`)
**Purpose:** Manage token inventory across multiple chains

**Features:**
- Loads configuration from `inventory.json`
- Tracks balances per token per chain
- Checks availability before quoting
- Reserves inventory when quote submitted
- Releases inventory if quote rejected
- Enforces minimum balance thresholds

**Key Functions:**
```typescript
canProvideQuote(chain, token, amount)
  → checkEnabled()
  → checkBalance()
  → checkMinimumThreshold()

reserveInventory(quoteId, chain, token, amount)
updateBalance(chain, token, newBalance)
```

#### 4. **Nep413SignerService** (`src/services/nep413-signer.service.ts`)
**Purpose:** NEP-413 message signing for quote authentication

**Process:**
```typescript
createSignedQuote(quoteData)
  → createNEP413Message()    // Format per NEP-413 spec
  → signMessage()             // Sign with NEAR private key
  → encodeSignature()         // ed25519:base58 format
```

**NEP-413 Message Format:**
```
tag: 2147484061 (quote tag)
message: <quote_id>|<amount_out>|<recipient>|<nonce>
recipient: solver.near
nonce: timestamp in nanoseconds
```

#### 5. **ChainKeysService** (`src/services/chain-keys.service.ts`)
**Purpose:** Manage private keys for all supported chains

**Supported Chains:**
- EVM chains (Ethereum, Arbitrum, Polygon, etc.)
- NEAR Protocol
- Bitcoin
- Solana (coming soon)

**Key Functions:**
```typescript
getWallet(chain) → ethers.Wallet | near.Account | bitcoin.ECPair
getAddress(chain) → string
getSigner(chain) → provider-specific signer
```

#### 6. **LockService** (`src/services/lock.service.ts`)
**Purpose:** Distributed locking for concurrent operations

**Features:**
- Redis-based locks (with auto-fallback to in-memory)
- Prevents duplicate quote processing
- Handles race conditions
- Auto-cleanup on connection errors

### 🎮 Controllers

#### **SolverBusController** (`src/controllers/solver-bus.controller.ts`)
**Endpoints:**
- `GET /solver-bus/status` - Check WebSocket connection status
- `POST /solver-bus/reconnect` - Force reconnect to Solver Bus

### 📊 Data Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. WebSocket Message                                        │
│    Solver Relay → SolverBusService                          │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. Parse & Validate                                         │
│    Extract: quote_id, origin_asset, dest_asset, amount      │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Acquire Lock                                             │
│    LockService.acquireLock(quote_id)                        │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Fetch Prices                                             │
│    SimplePricingService.calculateQuote()                    │
│    ├─ Try Binance API                                       │
│    ├─ Try OKX API (if Binance fails)                        │
│    └─ Use Fallback Prices                                   │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Check Inventory                                          │
│    InventoryService.canProvideQuote()                       │
│    ├─ Token enabled?                                        │
│    ├─ Sufficient balance?                                   │
│    └─ Above minimum threshold?                              │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Reserve Inventory                                        │
│    InventoryService.reserveInventory()                      │
│    Update balance: current - amount_out                     │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Sign Quote                                               │
│    Nep413SignerService.createSignedQuote()                  │
│    NEP-413 format + ed25519 signature                       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Submit to Solver Bus                                     │
│    WebSocket.send({ method: "quote", params: {...} })       │
└────────────────┬────────────────────────────────────────────┘
                 │
                 ▼
┌─────────────────────────────────────────────────────────────┐
│ 9. Wait for Status Update                                   │
│    Status: "filled" → Execute transfer                      │
│    Status: "rejected" → Release inventory                   │
└─────────────────────────────────────────────────────────────┘
```

## � Solver Bus Integration

This Market Maker can **automatically compete for quotes** from NEAR Intents protocol via **Solver Relay WebSocket**.

### Quick Start

1. **Configure NEAR account** for NEP-413 signing:
```bash
# .env
SOLVER_BUS_ENABLED=true
NEAR_ACCOUNT_ID=solver.yourname.near
CHAIN_NEAR_PRIVATE_KEY=ed25519:your_private_key
```

2. **Start server** (auto-connects to Solver Relay):
```bash
npm run start:dev
```

3. **Check status**:
```bash
curl http://localhost:8080/solver-bus/status
```

**Full Guide:** See [SOLVER_BUS_GUIDE.md](./SOLVER_BUS_GUIDE.md) for complete WebSocket integration details.

##  Security Best Practices

### Private Key Management
- ✅ Store private keys in `.env` (never commit to git)
- ✅ Use environment variables in production
- ✅ Consider AWS KMS or HashiCorp Vault for production
- ✅ Rotate keys periodically
- ✅ Use separate keys for testnet/mainnet

### Inventory Protection
- ✅ Set appropriate `minBalance` thresholds
- ✅ Monitor balances regularly
- ✅ Implement alerts for low inventory
- ✅ Enable only trusted tokens
- ✅ Start with small amounts for testing

### Operational Security
- ✅ Enable Redis authentication in production
- ✅ Use HTTPS for all external API calls
- ✅ Implement rate limiting
- ✅ Monitor for unusual activity
- ✅ Keep dependencies updated

### Quote Signing Security
- ✅ NEP-413 signatures prevent quote tampering
- ✅ Nonce prevents replay attacks
- ✅ Each quote is cryptographically signed
- ✅ Only your NEAR account can sign quotes

## 🌐 Supported Chains

### Fully Supported (with token transfers)
- ✅ **NEAR Protocol** - NEP-141 tokens
- ✅ **Ethereum** - ERC-20 tokens
- ✅ **Arbitrum** - ERC-20 tokens
- ✅ **Polygon** - ERC-20 tokens
- ✅ **Optimism** - ERC-20 tokens
- ✅ **Base** - ERC-20 tokens
- ✅ **Binance Smart Chain (BSC)** - BEP-20 tokens
- ✅ **Avalanche C-Chain** - ERC-20 tokens
- ✅ **Aurora** - ERC-20 tokens
- ✅ **Bitcoin** - Native BTC transfers

### Coming Soon
- 🔄 **Solana** - SPL tokens
- 🔄 **Cosmos** - IBC tokens

### Adding New Chains
1. Add chain configuration to `ChainKeysService`
2. Add private key to `.env`
3. Implement transfer logic in execution service
4. Add tokens to `inventory.json`
5. Test with small amounts first

## 📊 Quote Lifecycle

### Quote States
1. **`RECEIVED`** - Quote request received from Solver Bus
2. **`PRICING`** - Fetching prices from Binance/OKX
3. **`INVENTORY_CHECK`** - Checking if we can provide quote
4. **`RESERVED`** - Inventory reserved, quote signed
5. **`SUBMITTED`** - Quote sent to Solver Bus
6. **`FILLED`** - Quote accepted by user (execute transfer)
7. **`REJECTED`** - Quote rejected (release inventory)
8. **`EXPIRED`** - Quote timeout (release inventory)

### Execution Flow (when filled)
1. **Receive `filled` status** from Solver Bus
2. **Get wallet** for destination chain
3. **Build transfer transaction** with reserved amount
4. **Sign & broadcast** transaction
5. **Update inventory** balances
6. **Log transaction** hash and details

## ⚙️ Configuration Files

### `inventory.json`
```json
{
  "chains": {
    "<chain_name>": {
      "tokens": [
        {
          "address": "token_contract_address",
          "symbol": "TOKEN",
          "decimals": 18,
          "currentBalance": "1000000000000000000",
          "minBalance": "100000000000000000",
          "enabled": true
        }
      ]
    }
  }
}
```

**Fields:**
- `address` - Token contract address (or token name for NEAR)
- `symbol` - Display symbol
- `decimals` - Token decimals (e.g., 18 for most ERC-20s)
- `currentBalance` - Current inventory in smallest unit
- `minBalance` - Minimum balance to maintain (won't quote below this)
- `enabled` - Whether to accept quotes for this token

### `.env` Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `SOLVER_BUS_ENABLED` | Enable Solver Bus | `true` |
| `SOLVER_BUS_SIMULATION` | Log only, don't send quotes | `false` |
| `NEAR_ACCOUNT_ID` | NEAR account for signing | `solver.near` |
| `CHAIN_<CHAIN>_PRIVATE_KEY` | Private key per chain | `0x...` or `ed25519:...` |
| `MARKUP_PCT` | Profit markup percentage | `0.005` (0.5%) |
| `INVENTORY_CONFIG_PATH` | Path to inventory.json | `./inventory.json` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |

## � Performance & Monitoring

### Key Metrics to Track
- **Quote Success Rate** - % of quotes that are filled
- **Price API Latency** - Time to fetch prices (Binance/OKX)
- **Inventory Turnover** - How often tokens are traded
- **Profit Margin** - Average markup earned per trade
- **Quote Competition Win Rate** - % of your quotes selected

### Logging
The system logs important events:
```
[SolverBusService] ✅ Connected to Solver Bus WebSocket
[SimplePricingService] ✅ Binance price for USDC: $1.00
[InventoryService] Reserved 1000000 USDC for quote abc-123
[Nep413SignerService] ✅ Quote signed: abc-123
[SolverBusService] 📨 Submitted quote: abc-123
[SolverBusService] ✅ Quote filled: abc-123
[ExecutionService] 🔄 Executing transfer: 1000000 USDC
[ExecutionService] ✅ Transfer complete: tx_hash
```

### Health Checks
```bash
# WebSocket connection
curl http://localhost:8080/solver-bus/status

# Redis connection
redis-cli ping

# Process status
ps aux | grep node
```

### Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| No quotes received | WebSocket disconnected | Check logs, restart server |
| Prices not updating | API timeout | Check Binance/OKX API status |
| Inventory errors | Balance too low | Top up tokens or adjust minBalance |
| Sign errors | Invalid NEAR key | Check NEAR_PRIVATE_KEY format |
| Redis errors | Redis not running | Start Redis or disable in .env |

## 🧪 Testing

Run tests:
```bash
npm test
```

## 📦 Deployment

1. Set up environment variables in your deployment platform
2. Configure Redis and PostgreSQL connections
3. Build the application: `npm run build`
4. Start: `npm start`
5. Set up monitoring and logging
6. Configure auto-scaling for production traffic

## 🔗 Resources

- [NEAR Intents Documentation](https://docs.near-intents.org/near-intents)
- [Solver Bus WebSocket API](https://docs.near-intents.org/near-intents/integration/solver-bus)
- [NEP-413 Specification](https://github.com/near/NEPs/blob/master/neps/nep-0413.md)
- [Binance Web3 API](https://web3.binance.com)
- [OKX DEX API](https://web3.okx.com)

## 💡 Roadmap & Future Improvements

### Immediate Priorities
- [ ] **Complete transfer execution** - Implement actual token transfers when quotes filled
- [ ] **Transaction monitoring** - Track transaction status on destination chain
- [ ] **Automatic inventory updates** - Update balances after transfers
- [ ] **Error recovery** - Handle failed transfers and refunds

### Enhancements
- [ ] **Multiple price sources** - Add CoinGecko, CoinMarketCap
- [ ] **Dynamic markup** - Adjust based on volatility and liquidity
- [ ] **Inventory rebalancing** - Auto-move funds between chains
- [ ] **Historical analytics** - Track performance over time
- [ ] **Alerting system** - Notify on low inventory, failed quotes, etc.

### Advanced Features
- [ ] **Machine learning pricing** - Optimize markup based on win rate
- [ ] **Risk management** - Position limits, exposure caps
- [ ] **Multi-solver coordination** - Run multiple solver instances
- [ ] **MEV protection** - Detect and avoid toxic orderflow
- [ ] **Automated hedging** - Hedge inventory risk on DEXs

### Infrastructure
- [ ] **Prometheus metrics** - Export detailed metrics
- [ ] **Grafana dashboards** - Visualize performance
- [ ] **Docker optimization** - Smaller images, better caching
- [ ] **Kubernetes deployment** - Scale horizontally
- [ ] **Database persistence** - Store quotes, trades, inventory history

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## ⚠️ Disclaimer

**This software is for educational and development purposes.**

- Trading carries risk of loss
- Test thoroughly before using real funds
- Start with small amounts
- Monitor inventory and balances
- No warranty or guarantee of profits
- You are responsible for your own funds and private keys

**Use at your own risk!**

