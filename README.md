# AI Bitcoin Trader (Gemini 2.0 Flash) - V4.0

**The "Self-Reflecting" Autonomous Trading Agent.**
Powered by **Google Gemini 2.0 Flash**, this bot trades Bitcoin Perpetual Futures using a sophisticated **Multi-Timeframe Confluence** strategy. It analyzes Market Structure, Momentum, and Risk/Reward in real-time.

---

## 🧠 Core Architecture: Strategy V4 (Confluence & Risk)

Unlike simple bots, this AI uses a top-down approach combining **Macro Trend**, **Micro Structure**, and **Strict Risk Management**.

### 1. Macro Trend Determination (The Compass)
Before every trade, the AI determines the **Global Bias** by analyzing **4-Hour** and **1-Hour** charts together with the **1-Minute White Zone**.

*   **Strong Bullish**:
    *   Price > **EMA 50** on 4H & 1H.
    *   **White Zone (SuperTrend)** is UPTREND.
    *   *Action*: **ONLY Long** setups are permitted. Shorting is forbidden.
*   **Strong Bearish**:
    *   Price < **EMA 50** on 4H & 1H.
    *   **White Zone (SuperTrend)** is DOWNTREND.
    *   *Action*: **ONLY Short** setups are permitted. Longing is forbidden.
*   **Neutral / Conflict**:
    *   Timeframes disagree.
    *   *Action*: Enter **Strategy B (Range)** or **STAY (Cash is King)**.

### 2. Strategy Logic (The Brain)

#### ⚔️ Strategy A: Fractal Momentum (Trend Following)
*   **Best For**: Strong trending markets.
*   **Trigger**:
    1.  **Pullback**: Price retraces to **5m VWAP** or **5m EMA 50**.
    2.  **Confirmation**: A **Pinbar** or **Rejection Candle** forms on the 1m/5m chart.
    3.  **Volume**: Verified by average volume (no thin air trades).
    4.  **Entry**: Market execution in the direction of the Macro Trend.

#### 🛡️ Strategy B: Mean Reversion (Range Trading)
*   **Best For**: Sideways / Choppy markets.
*   **Trigger**:
    1.  **Overextended**: RSI > 70 (Sell) or RSI < 30 (Buy).
    2.  **Boundary Hit**: Price touches the **Bollinger Band** outer bands.
    3.  **Entry**: Reversal candle pattern against the bound.
    4.  **Target**: Return to **VWAP** (Mean).

### 3. Safety & Risk Management (The Shield) - *NEW in V4*

#### A. Advanced Support & Resistance
The AI is aware of "Major Levels" and will **NEVER** trade directly into them:
*   **EMA 200 (4H/1H)**: The "Wall".
*   **VWAP (Session)**: The "Magnet".
*   **Swing Highs/Lows (Fractals)**: Recent structural pivots.
*   **White Zone Limits**: SuperTrend dynamic bounds.

> *Rule: "Never Buy immediately below Resistance. Never Sell immediately above Support."*

#### B. Mandatory Risk:Reward (1.5:1)
Every trade MUST mathematically make sense.
*   **Calculation**: `(Target Price - Entry Price) / (Entry Price - Stop Loss)`
*   **Rule**: If the Ratio is **< 1.5**, the trade is **SKIPPED**, even if the setup looks good.

#### C. Volume Confirmation
*   **Breakout Filter**: If trading Strategy B (Reversal), but **Volume is > 200%** of average, the AI assumes a **Breakout** is happening and aborts the counter-trend trade.

---

## 🔍 Input Data Layer
The AI receives a rich context window every 5 minutes:
1.  **Macro Context**: 4H/1H EMA 50/200, ADX, Swing Points.
2.  **Micro Context**: 5m VWAP, RSI, Bollinger Bands.
3.  **White Zone**: Real-time 1m SuperTrend status and bounds.
4.  **Wallet & Positions**: Real-time PnL monitoring for active management.

---

## 🛠️ Technology Stack
*   **AI**: Google Gemini 2.0 Flash
*   **Backend**: Node.js / TypeScript (Next.js Worker)
*   **Database**: Supabase (PostgreSQL + Realtime)
*   **Frontend**: Next.js 14 App Router + Tailwind
*   **Deployment**: Railway (Docker)

---
*Built by Antigravity (Google Deepmind)*
