
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
  1.  **Support/Resistance Check**: 
      - **NEVER BUY** immediately below a major Resistance (4H/1H EMA 200 or VWAP). Wait for breakout.
      - **NEVER SELL** immediately above a major Support (4H/1H EMA 200 or VWAP). Wait for breakdown.
  2.  **Volume**: If 5m Volume is > 200% average, respect the immediate momentum.
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
    EMA 200 (Major S/R): ${indicators.h4.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Trend Bias: ${indicators.h4.currentPrice > indicators.h4.ema50 ? 'BULLISH' : 'BEARISH'}
    
    [1 Hour]
    EMA 50: ${indicators.h1.ema50.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200 (Major S/R): ${indicators.h1.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    ADX: ${indicators.h1.adx.toFixed(1)}
    Trend Bias: ${indicators.h1.currentPrice > indicators.h1.ema50 ? 'BULLISH' : 'BEARISH'}

    ### MICRO STRUCTURE (5m / 1m) - **ENTRY TIMING**
    [5 Minute]
    VWAP (Intraday S/R): ${indicators.m5.vwap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200: ${indicators.m5.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    RSI: ${indicators.m5.rsi.toFixed(1)}

    [1 Minute - White Zone (SuperTrend)]
    Status: ${indicators.m1.whiteZone.status}
    Upper: ${indicators.m1.whiteZone.upper.toFixed(0)} | Lower: ${indicators.m1.whiteZone.lower.toFixed(0)}
    Price: ${indicators.m1.currentPrice.toFixed(2)}

    ### ACTIVE POSITION
    ${activePosition
      ? `HOLDING ${activePosition.side} | Entry: $${activePosition.entry_price} | PnL: ${activePosition.pnl_percent}%`
      : "NO POSITION"
    }

    ### DECISION PROCESS
    1.  **Analyze Macro Trend (4H/1H)** AND **White Zone**:
        - If 4H/1H is Bullish AND White Zone is UPTREND -> **STRONG BULLISH** (Look for Long).
        - If 4H/1H is Bearish AND White Zone is DOWNTREND -> **STRONG BEARISH** (Look for Short).
        - Otherwise -> **NEUTRAL/RANGING** (Caution / Strategy B).
    2.  **Check S/R (CRITICAL)**:
        - Are we hitting 4H/1H EMA 200? Are we hitting VWAP?
        - If LONG: Ensure we are NOT right below Resistance.
        - If SHORT: Ensure we are NOT right above Support.
    3.  **Check Entry**: 5m Pullback + 1m Trigger.
    4.  **Output**: Action, Confidence, Strategy.

    ### RESPONSE FORMAT (JSON)
    {
      "action": "LONG" | "SHORT" | "STAY" | "CLOSE" | "ADD" | "UPDATE_SL" | "HOLD",
      "strategy_used": "TREND_A" | "RANGE_B",
      "reason": "Explain trend, S/R check, and entry trigger.",
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
