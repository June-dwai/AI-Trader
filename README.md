# 🤖 AI Bitcoin Trader

**Autonomous AI-Powered Bitcoin Futures Trading System** powered by Google Gemini 2.0 Flash

A fully autonomous trading bot that analyzes market data, executes trades, manages risk, tracks performance, and writes daily trading journals - all without human intervention.

![Version](https://img.shields.io/badge/version-4.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Platform](https://img.shields.io/badge/platform-Binance%20Futures-yellow)

---

## 📋 Table of Contents

- [Features](#-features)
- [Architecture](#-architecture)
- [Technology Stack](#-technology-stack)
- [Trading Strategy](#-trading-strategy)
- [Performance Tracking](#-performance-tracking)
- [Installation](#-installation)
- [Configuration](#-configuration)
- [Usage](#-usage)
- [Dashboard](#-dashboard)
- [API Endpoints](#-api-endpoints)
- [Deployment](#-deployment)
- [Disclaimer](#%EF%B8%8F-disclaimer)

---

## ✨ Features

### 🧠 AI-Driven Trading
- **Google Gemini 2.0 Flash** analyzes multi-timeframe market data
- **Multi-Strategy System**: Trend Following + Mean Reversion
- **Intelligent Position Sizing** with dynamic leverage calculation
- **Risk:Reward validation** (minimum 1.5:1 ratio)
- **Support/Resistance awareness** to avoid trading into key levels

### 📊 Real-Time Monitoring
- **WebSocket-based TP/SL execution** for instant order management
- **Live price tracking** with sub-second latency
- **Real-time PnL calculations** for open positions
- **Telegram notifications** for all trading activities

### 📈 Performance Analytics
- **Wallet History Tracking**: Records every balance change with timestamps
- **vs BTC Performance**: Compare your returns against Bitcoin's performance
- **Daily PnL Charts**: Visualize profit/loss trends over time
- **Win Rate Statistics**: Track trading accuracy
- **Alpha Calculation**: Measure outperformance vs BTC

### 📝 Auto-Generated Trading Journal
- **Daily Blog Posts** written by AI at 9 AM
- **Self-Reflection**: AI analyzes its own decisions
- **Trade Analysis**: Breakdown of wins, losses, and market conditions
- **Markdown formatting** with proper structure
- **Publicly accessible** at `/blog` endpoint

### 🎨 Modern Dashboard
- **Real-time price ticker** with WebSocket updates
- **Interactive charts** (TradingView, Performance, History)
- **Mobile-responsive design** with Tailwind CSS
- **Live trade execution logs**
- **Historical trade table** with filtering

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Next.js Frontend                       │
│  (Dashboard, Charts, Real-time Updates via Supabase)       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                   Supabase Backend                          │
│  • PostgreSQL Database (trades, logs, wallet_history)      │
│  • Real-time Subscriptions (WebSocket)                     │
│  • Row-Level Security (RLS)                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Trading Worker                           │
│  ┌────────────────┐  ┌────────────────┐                    │
│  │  AI Trader     │  │  Blog Writer   │                    │
│  │  (5 min loop)  │  │  (Daily 9 AM)  │                    │
│  └────────────────┘  └────────────────┘                    │
│                                                             │
│  ┌────────────────────────────────────────────────────┐   │
│  │        WebSocket TP/SL Monitor                     │   │
│  │        (Real-time price → instant execution)       │   │
│  └────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
                    │                  │
                    ▼                  ▼
         ┌──────────────────┐  ┌──────────────┐
         │  Binance API     │  │  Gemini AI   │
         │  (Market Data    │  │  (Decision   │
         │   + Execution)   │  │   Making)    │
         └──────────────────┘  └──────────────┘
```

### Core Components

#### 1. **Trading Bot** (`src/worker/trader.ts`)
- Runs every **5 minutes**
- Fetches multi-timeframe candle data (4H, 1H, 5M, 1M)
- Calculates technical indicators (EMA, RSI, VWAP, SuperTrend, Bollinger Bands)
- Sends market context to Gemini AI
- Executes trades based on AI decisions
- Logs all decisions to database

#### 2. **WebSocket Monitor** (`src/lib/binance-ws.ts`)
- Subscribes to Binance real-time price stream
- Monitors active positions 24/7
- Executes Take Profit / Stop Loss instantly when price hits targets
- No polling delays - instant execution

#### 3. **Blog Generator** (`src/worker/blogger.ts`)
- Scheduled to run daily at 9:00 AM
- Fetches trades and logs from the past 24 hours
- Uses Gemini AI to analyze performance
- Generates professional Markdown blog post
- Publishes to Supabase `posts` table

#### 4. **Wallet History Tracker**
- Records balance after every trade
- Fetches historical BTC prices for alpha calculation
- Stores daily PnL and return percentages
- Enables performance charting and analytics

---

## 🛠 Technology Stack

### Frontend
- **Next.js 16** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Utility-first styling
- **Recharts** - Performance charts
- **TradingView Widget** - Price charts
- **Lucide React** - Icon library

### Backend
- **Supabase** - PostgreSQL database + Real-time subscriptions
- **Node.js** - Runtime environment
- **tsx** - TypeScript execution

### AI & Data
- **Google Gemini 2.0 Flash** - AI decision making
- **Binance Futures API** - Market data & order execution
- **WebSocket** - Real-time price streaming

### DevOps
- **Docker** - Containerization
- **Railway** - Cloud deployment
- **GitHub Actions** - CI/CD (optional)

---

## 📊 Trading Strategy

The bot uses a **two-strategy system** that adapts to market conditions:

### Strategy A: Trend Following (Fractal Momentum)

**When to use**: Strong trending markets

**Conditions**:
1. **Macro Trend Confirmation**:
   - Price must be above/below EMA 50 on both 4H and 1H charts
   - SuperTrend (White Zone) must confirm trend direction
2. **Entry Trigger**:
   - Wait for pullback to 5M VWAP or EMA 50
   - Confirm with rejection candle (pinbar) on 1M/5M
   - Volume must be above average
3. **Execution**:
   - Enter in direction of trend
   - Set TP at next resistance/support
   - Set SL below/above recent swing point

### Strategy B: Mean Reversion (Range Trading)

**When to use**: Sideways or choppy markets

**Conditions**:
1. **Overextension Detection**:
   - RSI > 70 (overbought) or RSI < 30 (oversold)
   - Price touching Bollinger Band extremes
2. **Entry Trigger**:
   - Reversal candle pattern
   - No high volume (to avoid breakouts)
3. **Execution**:
   - Enter counter-trend
   - Target: Return to VWAP (mean)
   - Tight stop loss

### Risk Management

#### 1. Position Sizing
```typescript
// Dynamic leverage based on ATR volatility
const leverage = Math.min(
  Math.max(1, Math.floor(maxLossPercent / (atrPct * 2))),
  10
);

// Position size calculation
const positionSize = (balance * maxLossPercent) / (slDistance * leverage);
```

#### 2. Mandatory Checks
- ✅ **Risk:Reward Ratio** must be ≥ 1.5:1
- ✅ **No trading into major levels** (EMA 200, session VWAP, swing points)
- ✅ **Volume confirmation** (avoid thin-air trades)
- ✅ **Trend alignment** (don't fight the macro trend)

#### 3. Real-Time Monitoring
- WebSocket monitors price every tick
- Executes TP/SL instantly when hit
- No polling delays, no missed exits
- Calculates live PnL for risk assessment

---

## 📈 Performance Tracking

### Wallet History System

Every trade is recorded with:
- **Timestamp** (closed_at)
- **Balance** (USDT after trade)
- **BTC Price** (for alpha calculation)
- **Daily PnL** (profit/loss for that day)
- **Daily Return %**

### Analytics Dashboard

#### 1. **Balance Tracker (USDT)**
- Line chart showing wallet growth over time
- Initial balance: 1000 USDT

#### 2. **vs BTC Comparison (%)**
- **Green line**: Your portfolio return %
- **Red line**: Bitcoin return %
- Shows if you're outperforming BTC (alpha)

#### 3. **Daily PnL (USDT)**
- Bar chart with conditional coloring
- 🟢 Green bars = Profitable days
- 🔴 Red bars = Loss days

#### 4. **Daily Return (%)**
- Percentage return per day
- Same green/red color coding

### Key Metrics

```
┌─────────────────────┬──────────────────────┐
│  Current Balance    │  Alpha vs BTC        │
│  $2,772 USDT        │  +195.3%             │
│  (+1,772 USDT)      │                      │
├─────────────────────┼──────────────────────┤
│  Avg Daily Profit   │  Win Rate            │
│  +$161.02           │  52.5% (21/40)       │
└─────────────────────┴──────────────────────┘
```

---

## 🚀 Installation

### Prerequisites
- **Node.js** 18+ and npm
- **Supabase** account (free tier works)
- **Binance Futures** account with API key
- **Google AI Studio** API key (Gemini)
- **Telegram Bot** token (optional)

### Step 1: Clone Repository
```bash
git clone https://github.com/June-dwai/AI-Trader.git
cd AI-Trader
```

### Step 2: Install Dependencies
```bash
npm install
```

### Step 3: Set Up Supabase

1. Create a new Supabase project
2. Run the following SQL migrations:

```sql
-- Wallet table
CREATE TABLE wallet (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  balance NUMERIC NOT NULL DEFAULT 1000,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Trades table
CREATE TABLE trades (
  id BIGSERIAL PRIMARY KEY,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL,
  entry_price NUMERIC NOT NULL,
  leverage INTEGER NOT NULL,
  size NUMERIC NOT NULL,
  status TEXT NOT NULL,
  opened_at TIMESTAMPTZ DEFAULT NOW(),
  closed_at TIMESTAMPTZ,
  pnl NUMERIC,
  stop_loss NUMERIC,
  take_profit NUMERIC
);

-- Wallet history table
CREATE TABLE wallet_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  timestamp TIMESTAMPTZ NOT NULL,
  balance NUMERIC NOT NULL,
  btc_price NUMERIC NOT NULL,
  daily_pnl NUMERIC,
  daily_return_pct NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Logs table
CREATE TABLE logs (
  id BIGSERIAL PRIMARY KEY,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Posts table (for blog)
CREATE TABLE posts (
  id BIGSERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Step 4: Configure Environment Variables

Create `.env.local`:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Binance
BINANCE_API_KEY=your_binance_api_key
BINANCE_SECRET=your_binance_secret

# Google Gemini
GEMINI_API_KEY=your_gemini_api_key

# Telegram (optional)
TELEGRAM_BOT_TOKEN=your_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

---

## 🎮 Usage

### Development Mode
```bash
# Start Next.js dev server only
npm run dev

# Start trading worker only
npm run worker

# Start both (recommended)
npm start
```

### Production Mode
```bash
# Build the application
npm run build

# Start both Next.js and worker
npm start
```

### Backfill Wallet History
If you have existing trades and want to populate historical data:

```bash
npx tsx src/worker/backfill-wallet-history.ts
```

This script will:
- Fetch all closed trades
- Calculate balance after each trade
- Fetch historical BTC prices
- Populate `wallet_history` table

---

## 🖥 Dashboard

Access the dashboard at `http://localhost:3000`

### Main Features

#### 1. **Statistics Cards**
- Current Balance (with profit/loss)
- Alpha Yield vs BTC
- Average Daily Profit
- Win Rate

#### 2. **Active Position Card**
- Current trade details
- Live PnL updates
- Entry price, TP, SL levels
- Time in trade

#### 3. **TradingView Chart**
- Interactive price chart
- Technical indicators overlay
- Drawing tools

#### 4. **Performance Charts**
- Asset Trend (USDT)
- vs BTC (%)
- Daily PnL (USDT)
- Daily Return (%)

#### 5. **Real-time Logs**
- AI decision logs
- Trade execution logs
- WebSocket updates
- Auto-scroll with live updates

#### 6. **Trade History Table**
- All closed trades
- PnL, leverage, duration
- Sortable columns
- Color-coded by profit/loss

---

## 🔌 API Endpoints

### Admin API

#### `POST /api/admin/close-position`
Manually close the active position.

**Request:**
```json
{
  "action": "close"
}
```

**Response:**
```json
{
  "success": true,
  "pnl": 145.23
}
```

#### `GET /api/admin/trades`
Fetch all trades with optional filters.

**Query Params:**
- `status`: "OPEN" | "CLOSED"
- `limit`: number

**Response:**
```json
{
  "trades": [...]
}
```

### Market Data

#### `GET /api/market/history`
Returns wallet history data for charts.

**Response:**
```json
{
  "history": [
    {
      "timestamp": "2026-01-27T03:03:02.002Z",
      "balance": 857.41,
      "btc_price": 88744.60,
      "daily_pnl": -142.59,
      "daily_return_pct": -14.26
    },
    ...
  ]
}
```

---

## 🚢 Deployment

### Docker Deployment

1. **Build Image:**
```bash
docker build -t ai-trader .
```

2. **Run Container:**
```bash
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_SUPABASE_URL=... \
  -e NEXT_PUBLIC_SUPABASE_ANON_KEY=... \
  -e SUPABASE_SERVICE_ROLE_KEY=... \
  -e BINANCE_API_KEY=... \
  -e BINANCE_SECRET=... \
  -e GEMINI_API_KEY=... \
  ai-trader
```

### Railway Deployment

1. Connect your GitHub repository
2. Set environment variables in Railway dashboard
3. Deploy automatically on push

Railway will:
- Build the Docker image
- Start both Next.js and worker processes
- Provide a public URL

---

## ⚠️ Disclaimer

**IMPORTANT: READ CAREFULLY**

This software is provided **AS-IS** for **educational and research purposes only**.

- ❌ **NOT FINANCIAL ADVICE**: This bot is not a licensed financial advisor
- ❌ **TRADING RISK**: Cryptocurrency trading involves substantial risk of loss
- ❌ **NO GUARANTEE**: Past performance does not guarantee future results
- ❌ **USE AT YOUR OWN RISK**: The developers are not responsible for any financial losses

### Risks

1. **Market Risk**: Crypto markets are highly volatile
2. **Technical Risk**: Bugs, API failures, network issues
3. **Leverage Risk**: Futures trading can amplify losses
4. **AI Risk**: AI decisions may not always be optimal

### Best Practices

- ✅ Start with a **small amount** you can afford to lose
- ✅ Test thoroughly on **testnet** first
- ✅ Monitor the bot regularly
- ✅ Set strict loss limits
- ✅ Keep API keys secure
- ✅ Enable 2FA on all accounts

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file for details.

---

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

---

## 📞 Support

For issues and questions:
- Open a GitHub Issue
- Check existing documentation
- Review the code comments

---

**Built with ❤️ by the AI Trader Team**

*Powered by Google Gemini 2.0 Flash | Binance Futures API | Supabase*

---

## 🗺 Roadmap

- [ ] Multi-asset support (ETH, SOL, etc.)
- [ ] Backtesting framework
- [ ] Advanced risk management (position hedging)
- [ ] Mobile app
- [ ] Discord bot integration
- [ ] Portfolio rebalancing
- [ ] Machine learning model training on historical trades

---

**Version 4.0** - Last Updated: February 2026
