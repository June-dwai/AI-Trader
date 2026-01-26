
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
  You have TWO strategies available. Select the BEST one based on the GLOBAL TREND (4H/1H).

  === MACRO TREND DETERMINATION (CRITICAL) ===
  1.  **BULLISH TREND**:
      - 4H Price > 4H EMA 50
      - 1H Price > 1H EMA 50
      - 1H ADX > 20 (Strong Trend)
      -> **ONLY LOOK FOR LONG SETUPS (Pullbacks).**

  2.  **BEARISH TREND**:
      - 4H Price < 4H EMA 50
      - 1H Price < 1H EMA 50
      - 1H ADX > 20 (Strong Trend)
      -> **ONLY LOOK FOR SHORT SETUPS (Rallies).**

  3.  **RANGING / WEAK TREND**:
      - Price is chopping around EMA 50 on 4H/1H.
      - 1H ADX < 20.
      -> **USE STRATEGY B (Mean Reversion). Play both sides but favor the 4H EMA slope.**

  === STRATEGY A: FRACTAL MOMENTUM (TREND FOLLOWING) ===
  *   **When to use**: Strong Bullish or Bearish Macro Trend.
  *   **Logic**:
      1.  **Wait for Pullback**: Price returns to 5m VWAP or 5m EMA 50.
      2.  **Trigger**: 1m/5m candle rejection (Wick) or Pinbar carrying volume.
      3.  **Execution**: Enter in direction of the MACRO TREND.

  === STRATEGY B: MEAN REVERSION (RANGE) ===
  *   **When to use**: Weak Trend / Ranging.
  *   **Logic**:
      1.  **Regime**: Price chopping around VWAP.
      2.  **Trigger**: RSI Extreme (>70 Sell, <30 Buy) + Bollinger Band Touch.
      3.  **Target**: Return to VWAP.
  
  === SAFETY RULES ===
  1.  **Avoid Counter-Trend**: If 4H/1H ADX > 25, DO NOT FADE the trend (e.g., don't Short a strong Bull market just because RSI is 70).
  2.  **Volume Check**: If 5m Volume is > 200% average, respect the immediate momentum.
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
    Trend Bias: ${indicators.h4.currentPrice > indicators.h4.ema50 ? 'BULLISH' : 'BEARISH'}
    
    [1 Hour]
    EMA 50: ${indicators.h1.ema50.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    ADX: ${indicators.h1.adx.toFixed(1)} (${indicators.h1.adx > 25 ? 'Trending' : 'Weak'})
    Trend Bias: ${indicators.h1.currentPrice > indicators.h1.ema50 ? 'BULLISH' : 'BEARISH'}

    ### MICRO STRUCTURE (5m / 1m) - **ENTRY TIMING**
    [5 Minute]
    VWAP: ${indicators.m5.vwap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    RSI: ${indicators.m5.rsi.toFixed(1)}
    ADX: ${indicators.m5.adx.toFixed(1)} (Ignore for trend, use for volatility)

    [1 Minute - White Zone]
    Status: ${indicators.m1.whiteZone.status}
    Upper: ${indicators.m1.whiteZone.upper.toFixed(0)} | Lower: ${indicators.m1.whiteZone.lower.toFixed(0)}
    Price: ${indicators.m1.currentPrice.toFixed(2)}

    ### ACTIVE POSITION
    ${activePosition
      ? `HOLDING ${activePosition.side} | Entry: $${activePosition.entry_price} | PnL: ${activePosition.pnl_percent}%`
      : "NO POSITION"
    }

    ### DECISION PROCESS
    1.  **Analyze Macro Trend (4H/1H)**: Determine if we are Bullish, Bearish, or Ranging.
    2.  **Filter**:
        - If Bullish: IGNORE all Short signals. Look for Long entries near 5m VWAP.
        - If Bearish: IGNORE all Long signals. Look for Short entries near 5m VWAP.
        - If Ranging: Trade Strategy B (RSI extremes).
    3.  **Check Entry Trigger**: 1m/5m Price Action confirmation.
    4.  **Output**: Action, Confidence, Strategy.

    ### RESPONSE FORMAT (JSON)
    {
      "action": "LONG" | "SHORT" | "STAY" | "CLOSE" | "ADD" | "UPDATE_SL" | "HOLD",
      "strategy_used": "TREND_A" | "RANGE_B",
      "reason": "Concise reasoning based on 4H/1H trend and 5m entry.",
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
