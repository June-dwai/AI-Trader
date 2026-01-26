
import { GoogleGenerativeAI } from '@google/generative-ai';
import { calculateIndicators } from './indicators';
import { MarketData } from './market';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export interface TradeDecision {
  action: 'LONG' | 'SHORT' | 'STAY' | 'CLOSE' | 'ADD' | 'UPDATE_SL' | 'HOLD';
  reason: string;
  confidence: number;
  stopLoss: number;
  takeProfit: number;
  riskPerTrade: number;
  setup_reason?: string;
  strategy_used?: string; // e.g., "TREND_A" or "RANGE_B"
  next_setup?: {
    short_level: number;
    long_level: number;
    comment: string;
  };
}

const STRATEGIES = `
  You have TWO strategies available. Select the BEST one based on the current Market Regime.

  === STRATEGY A: FRACTAL MOMENTUM (TREND) ===
  *   **Best For**: Trending Markets (ADX > 25).
  *   **Logic**:
      1.  **Trend**: Price > VWAP (Bullish) or Price < VWAP (Bearish).
      2.  **Validation**: Price & OI rising together.
      3.  **Entry**: Pullback to VWAP/EMA50 on 5m.
      4.  **Confirm**: Pinbar/Rejection on 1m WITH VOLUME SUPPORT.

  === STRATEGY B: MEAN REVERSION (RANGE) ===
  *   **Best For**: Chopping/Sideways Markets (ADX < 20).
  *   **Logic**:
      1.  **Regime**: Price chopping around VWAP. Low ADX.
      2.  **Trigger**: RSI Extreme (>70 Short, <30 Long) AND Price hits Bollinger Band Outer Bands (or simple 2.5 ATR deviation).
      3.  **Entry**: Reversal candle (Hammer/Shooting Star) at the extremes.
      4.  **Target**: Return to VWAP (Mean).
  
  === BLIND SPOT & SAFETY RULES ===
  1.  **Transition Zone (ADX 20-25)**: The trend is unclear. Manage existing positions but **DO NOT ENTER NEW TRADES (STAY)**.
  2.  **Strategy B Safety Lock**: Even if RSI > 70, **CHECK VOLUME**. If Volume is Spiking (>200% of avg), it's a BREAKOUT, NOT A REVERSAL. **ABORT SHORT**.
  3.  **1m Noise Filter**: Do not trust 1m patterns unless they have significant volume.
`;

export async function getAiDecision(
  indicators: ReturnType<typeof calculateIndicators>,
  marketData: MarketData,
  oiHistory: number[],
  fundingHistory: number[],
  previousDecision: TradeDecision | null,
  recentTrades: string,
  activePosition: any | null // Current Open Trade Details
): Promise<TradeDecision> {
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.0-flash',
    generationConfig: { responseMimeType: 'application/json' }
  });

  const prompt = `
    Act as an elite Autonomous AI Trader.
    ${STRATEGIES}

    ### REAL-TIME MARKET DATA (Weighted Aggregation)
    Current Price: $${marketData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    Funding Rate: ${marketData.fundingRate.toFixed(6)}%
    Funding Rate History: [${fundingHistory.map(f => f.toFixed(6)).join(', ')}]
    Open Interest: ${marketData.openInterest.toLocaleString('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} BTC
    Open Interest History: [${oiHistory.map(oi => oi.toFixed(2)).join(', ')}]
    
    ### TECHNICAL INDICATORS
    [1 Hour (Session)]
    VWAP: ${indicators.h1.vwap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    ADX: ${indicators.h1.adx.toFixed(1)}

    [5 Minute (Micro)]
    VWAP: ${indicators.m5.vwap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    ATR (14): ${indicators.m5.atr.toFixed(1)}
    RSI: ${indicators.m5.rsi.toFixed(1)}
    ADX: ${indicators.m5.adx.toFixed(1)}

    [1 Minute (White Zone - SUPER TREND)]
    Status: ${indicators.m1.whiteZone.status}
    Upper: ${indicators.m1.whiteZone.upper.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Lower: ${indicators.m1.whiteZone.lower.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Current Price: ${indicators.m1.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    *Rule*: 
    - UPTREND: Favor LONGs.
    - DOWNTREND: Favor SHORTs.
    - CHOP: Caution.

    [1 Minute (Execution)]
    Volume: ${indicators.m1.volume.toLocaleString('en-US')} (Confirm patterns with volume)

    ### ACTIVE POSITION STATUS
    ${activePosition
      ? `目前 HOLDING ${activePosition.side} | Entry: $${activePosition.entry_price} | PnL: ${activePosition.pnl_percent}% | Size: ${activePosition.size}`
      : "NO ACTIVE POSITION."
    }

    ### RECENT TRADING PERFORMANCE
    ${recentTrades}

    ### DECISION PROCESS
    
    **IF NO ACTIVE POSITION:**
    1. **The White Zone Filter (MANDATORY)**:
       - If Status is 'DOWNTREND', you are FORBIDDEN from taking LONG positions. Only SHORT or STAY.
       - If Status is 'UPTREND', you are FORBIDDEN from taking SHORT positions. Only LONG or STAY.
       - If Status is 'CHOP' or 'RUBBING', use Strategy B (Mean Reversion).
    2. **Identify Regime**: 
       - Trend (ADX > 25) -> Strategy A.
       - Range (ADX < 20) -> Strategy B.
       - **Transition (ADX 20-25)** -> **STAY** (Protect Capital).
    3. **Strategy Execution**:
       - **Strategy A (Trend)**: MUST align with White Zone direction.
       - **Strategy B (Range)**: 
         - If White Zone is DOWNTREND -> Only look for Short signals (Sell High).
         - If White Zone is UPTREND -> Only look for Long signals (Buy Low).
    4. **Safety Checks (CRITICAL)**:
       - **Strategy B**: If 5m Volume is massive while hitting bands, DO NOT FADE. It's a breakout.
       - **1m Confirmation**: Is the 1m candle pattern supported by volume?
    5. **Final Decision**: Output Action, Confidence, and Strategy Used.
    6. **Formatting**: Use comma separators for prices.

    **IF ACTIVE POSITION EXISTS (MANAGEMENT MODE):**
    1. **Check Exit**: Is PnL < Stop Loss? Or PnL > Take Profit? -> Output "CLOSE".
    2. **Smart Pyramiding (Strategy A Only)**:
       - Condition: PnL > 2% (or significant profit).
       - Logic: If Pullback occurred and resuming -> Output "ADD".
       - Requirement: MUST move Stop Loss to Breakeven first.
    3. **Trailing Stop**: If Price moved significantly in favor, Output "UPDATE_SL" to lock profits.
    4. **Hold**: If trend is intact and no new triggers -> Output "HOLD".

    ### RESPONSE FORMAT (JSON)
    {
      "action": "LONG" | "SHORT" | "STAY" | "CLOSE" | "ADD" | "UPDATE_SL" | "HOLD",
      "strategy_used": "TREND_A" | "RANGE_B" | "NONE",
      "reason": "Explain reasoning. Use commas for prices.",
      "confidence": Number (0-100),
      "stopLoss": Number,
      "takeProfit": Number,
      "riskPerTrade": Number,
      "setup_reason": "String"
    }
  `;

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    return JSON.parse(text) as TradeDecision;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return { action: 'STAY', reason: "AI Error", confidence: 0, stopLoss: 0, takeProfit: 0, riskPerTrade: 0 };
  }
}
