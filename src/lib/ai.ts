
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
  You have TWO strategies available. Select the BEST one based on the GLOBAL TREND (4H/1H) and CONFLUENCE.

  === MACRO TREND DETERMINATION (CRITICAL) ===
  1.  **STRONG BULLISH**:
      - 4H/1H Price > EMA 50
      - White Zone (1m) is UPTREND
      -> **ONLY LOOK FOR LONG SETUPS (Pullbacks).**

  2.  **STRONG BEARISH**:
      - 4H/1H Price < EMA 50
      - White Zone (1m) is DOWNTREND
      -> **ONLY LOOK FOR SHORT SETUPS (Rallies).**

  3.  **NEUTRAL / CONFLICT**:
      - 4H/1H Trend disagrees with White Zone.
      -> **USE STRATEGY B (Mean Reversion) or STAY.**

  === STRATEGY A: FRACTAL MOMENTUM (TREND FOLLOWING) ===
  *   **When to use**: Strong Bullish or Bearish Macro Trend.
  *   **Logic**:
      1.  **Wait for Pullback**: Price returns to 5m VWAP or 5m EMA 50.
      2.  **Trigger**: 1m/5m candle rejection/Pinbar.
      3.  **Execution**: Enter in direction of the MACRO TREND.

  === STRATEGY B: MEAN REVERSION (RANGE) ===
  *   **When to use**: Neutral / Range / Weak Trend.
  *   **Logic**:
      1.  **Regime**: Price chopping around VWAP.
      2.  **Trigger**: RSI Extreme (>70 Sell, <30 Buy) + Bollinger Band Touch.
      3.  **Target**: Return to VWAP.
  
  === SAFETY RULES (MUST FOLLOW) ===
  1.  **Support/Resistance Check (Confluence)**: 
      - **Major Levels**: 4H/1H EMA 200, VWAP, *Swing Highs/Lows*, and *White Zone Limits*.
      - **NEVER BUY** immediately below a Resistance. Breakout must be confirmed (candle close above).
      - **NEVER SELL** immediately above a Support. Breakdown must be confirmed.
  2.  **Risk Management (MANDATORY)**:
      - **RR Ratio**: Must be >= 1.5:1. (Distance to Take Profit >= 1.5 * Distance to Stop Loss).
      - If strict SL placement yields < 1.5 RR, **SKIP THE TRADE**.
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

    ### REAL-TIME MARKET DATA
    Current Price: $${marketData.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
    Funding: ${marketData.fundingRate.toFixed(6)}% | OI: ${marketData.openInterest.toLocaleString('en-US')} BTC

    ### MACRO TREND CONTEXT (4H / 1H) - **PRIMARY DRIVER**
    [4 Hour]
    EMA 50: ${indicators.h4.ema50.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200: ${indicators.h4.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Swing High/Low: $${indicators.h4.struct.high.toLocaleString()} / $${indicators.h4.struct.low.toLocaleString()}
    Trend Structure: ${indicators.h4.ema50 > indicators.h4.ema200 ? 'BULLISH (Golden Cross)' : 'BEARISH (Death Cross)'}
    Price Level: ${indicators.h4.currentPrice > indicators.h4.ema50 ? 'Above EMA 50' : 'Below EMA 50'}
    
    [1 Hour]
    EMA 50: ${indicators.h1.ema50.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200: ${indicators.h1.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Swing High/Low: $${indicators.h1.struct.high.toLocaleString()} / $${indicators.h1.struct.low.toLocaleString()}
    ADX: ${indicators.h1.adx.toFixed(1)}
    Trend Structure: ${indicators.h1.ema50 > indicators.h1.ema200 ? 'BULLISH (Golden Cross)' : 'BEARISH (Death Cross)'}

    ### MICRO STRUCTURE (5m / 1m) - **ENTRY TIMING**
    [5 Minute]
    VWAP (Intraday S/R): ${indicators.m5.vwap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200: ${indicators.m5.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Swing High/Low: $${indicators.m5.struct.high.toLocaleString()} / $${indicators.m5.struct.low.toLocaleString()}
    RSI: ${indicators.m5.rsi.toFixed(1)}

    [1 Minute - White Zone (SuperTrend)]
    Status: ${indicators.m1.whiteZone.status}
    Upper (S/R): ${indicators.m1.whiteZone.upper.toFixed(0)} | Lower (S/R): ${indicators.m1.whiteZone.lower.toFixed(0)}
    Price: ${indicators.m1.currentPrice.toFixed(2)}

    ### ACTIVE POSITION
    ${activePosition
      ? `HOLDING ${activePosition.side} | Entry: $${activePosition.entry_price} | PnL: ${activePosition.pnl_percent}%`
      : "NO POSITION"
    }

    ### DECISION PROCESS
    1.  **Analyze Macro Structure**: 
        - Look at EMA 50 vs EMA 200 on 4H/1H.
        - If EMA 50 < EMA 200 -> **BEARISH BIAS** (Even if Price > EMA 50, it's just a retracement).
        - If EMA 50 > EMA 200 -> **BULLISH BIAS**.
    2.  **Define Outlook**:
        - Should focus on ONE direction matching the Bias.
        - If Bias is Bearish, `next_setup` MUST be for a SHORT (e.g., "Wait for rally to X").
    3.  **Validate Setup (MANDATORY)**:
        - **Target Profit (TP)**: Must be at least **$1000** away from entry. (Do not scalp crumbs).
        - **Risk:Reward**: Must be >= 1.5.
    4.  **Output Decision**: Action, Confidence, Strategy.

    ### RESPONSE FORMAT (JSON)
    {
      "action": "LONG" | "SHORT" | "STAY" | "CLOSE" | "ADD" | "UPDATE_SL" | "HOLD",
      "strategy_used": "TREND_A" | "RANGE_B",
      "reason": "Explain Trend Structure (EMA Align), S/R check, and RR > 1.5 check.",
      "confidence": Number (0-100),
      "stopLoss": Number,
      "takeProfit": Number,
      "riskPerTrade": Number,
      "setup_reason": "String",
      "next_setup": {
        "short_level": Number,
        "long_level": Number,
        "comment": "Specific plan for the PRIMARY BIAS direction. e.g. 'Short at 98500 (EMA50)'"
      }
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
