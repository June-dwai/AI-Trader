# AI Bitcoin Trader (Gemini 2.0 Flash)

**The World's First "Self-Reflecting" Autonomous Trading Agent.**  
Powered by **Google Gemini 2.0 Flash**, this bot trades Bitcoin Perpetual Futures by adapting its strategy in real-time based on the **Market Regime** (Trend vs. Range).

---

## 🧠 Core Architecture: Adaptive Multi-Strategy (v3.0)

Unlike simple bots that always use the same logic, this AI identifies the "Market Weather" first, then chooses the appropriate tool.

### 1. Market Regime Detection (The "Eyes")
Before every decision, the AI analyzes **Market Structure** using weighted data from Binance (60%) and Bybit (40%).

*   **Trending Regime (Bully/Bearish)**: Detected when **1H ADX > 25** and Price is clearly above/below VWAP.
*   **Ranging Regime (Choppy/Sideways)**: Detected when **1H ADX < 20** and Price is oscillating around VWAP.

### 2. Strategy Selection (The "Brain")
The AI dynamically switches between two distinct strategies:

#### ⚔️ Strategy A: Fractal Momentum (Trend Following)
*   **When to use**: Strong Trends (**ADX > 25**).
*   **Logic**: "The trend is your friend."
    1.  **Trend Check**: Price > VWAP (Bullish) or Price < VWAP (Bearish).
    2.  **Flow Validation**: Price and **Open Interest (OI)** must rise together. (No fake-outs).
    3.  **Entry Trigger**: Wait for a precision pullback to **VWAP** or **EMA 50** on the 5-minute chart.
    4.  **Confirm**: Pinbar or Rejection candle on the 1-minute chart.

#### 🛡️ Strategy B: Mean Reversion (Range Trading)
*   **When to use**: Sideways/Choppy Markets (**ADX < 20**).
*   **Logic**: "Buy Low, Sell High."
    1.  **Regime Check**: Confirm low volatility (Bollinger Band Squeeze).
    2.  **Trigger**: **RSI Extreme** (>70 Short, <30 Long).
    3.  **Entry**: Reversal candle (Hammer/Shooting Star) at the Bollinger Outer Bands.
    4.  **Target**: Return to the mean (VWAP).

---

## 🛡️ Advanced Risk Management

### 1. Blind Spot Protection (Safety Locks)
*   **Transition Zone (Gray Zone)**: If **1H ADX is between 20-25**, the market direction is ambiguous. The bot strictly enforces **"STAY"** to avoid getting caught in false breakouts.
*   **Strategy B Safety Lock**: Even if RSI > 70 (Overbought), if **Volume Spikes (>200%)**, the bot aborts Shorting. This prevents fading a powerful Breakout candidate.
*   **1m Noise Filter**: All 5m/1m candle patterns (Pinbar/Rejection) must be confirmed by **Volume Support**. No volume = No trade.

### 2. Chop Filter (The "Shield")
*   **Problem**: Most bots die in chop.
*   **Solution**: If **5m ADX < 20** (Dead Momentum) AND no RSI extremes are met, the AI forces a **"STAY"** decision. It refuses to trade noise.

### 3. Self-Reflection Loop (The "Mirror")
*   **Problem**: Bots often repeat mistakes.
*   **Solution**: The AI receives a summary of its **recent 5 trades (Wins/Losses)**.
*   **Metacognition**: *"I lost the last 3 trades in this choppy range. I will raise my Confidence Threshold to 90% until I win again."*

### 4. Dynamic Leverage & Position Sizing
*   **Leverage**: High Volatility = Low Leverage (5x). Low Volatility = High Leverage (20x).
*   **Stop Loss**: Calculated dynamically using **ATR (Average True Range)**.
*   **Fees**: All PnL calculations deduct **0.05% Taker Fees**.

---

## 🔍 Input Data Layer
The AI processes a massive context window every 5 minutes:

1.  **Price & Funding**: Recent 30m history to detect spikes.
2.  **Open Interest (OI)**: Recent 30m history to analyze Smart Money flow.
3.  **Technical Indicators**:
    *   **Macro (4H)**: EMA20 vs EMA200.
    *   **Session (1H)**: VWAP, ADX.
    *   **Micro (5m)**: RSI, ATR, Bollinger Bands.
4.  **Memory**: Its own previous thought process (to prevent schizophrenic flipping).

---

## 🚀 How to Run

### 1. Start Dashboard
```bash
npm run dev
```

### 2. Start AI Worker
```bash
npm run worker
```

---

## 🔮 Roadmap v3.1
*   [x] **Chop Filter**: Implemented.
*   [x] **Self-Reflection**: Implemented.
*   [x] **Chart Visualization**: Real-time 1m Chart with White Zone, EMA 200, and VWAP.
*   [ ] **Liquidation Heatmap Integration**: Connect to CoinGlass API.

## 🛠️ Technology Stack

*   **Core Logic**: Node.js, TypeScript
*   **AI Engine**: Google Gemini 2.0 Flash (via `@google/generative-ai`)
*   **Database**: Supabase (PostgreSQL)
*   **Frontend**: Next.js 14 (App Router), Tailwind CSS
*   **Charting**: TradingView Lightweight Charts (v5)
*   **Market Data**: Binance Futures API (Data Source), Bybit (Cross-check)
*   **Deployment**: Local Worker + Web Dashboard

---
*Built by Antigravity (Google Deepmind) for the elite trader.*
