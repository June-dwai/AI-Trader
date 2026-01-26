
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
  You have TWO strategies available. Select the BEST one based on the GLOBAL TREND STRUCTURE (EMA 50 vs EMA 200).

  === MACRO TREND DETERMINATION (CRITICAL) ===
  1.  **BULLISH STRUCTURE** (Golden Cross):
      - **EMA 50 > EMA 200** on 4H/1H.
      - **Bias**: LONG ONLY. (Price drops are PULLBACKS to Support).
      - **Key Supports**: EMA 50, EMA 200, VWAP, Previous Swing Highs.

  2.  **BEARISH STRUCTURE** (Death Cross):
      - **EMA 50 < EMA 200** on 4H/1H.
      - **Bias**: SHORT ONLY. (Price rallies are RETRACEMENTS to Resistance).
      - **Key Resistances**: EMA 50, EMA 200, VWAP, Previous Swing Lows.

  3.  **NEUTRAL / FLAT**:
      - EMA 50 and EMA 200 are flat/intertwined OR Timeframe Conflict.
      - **Action**: Use Strategy B (Range).

  === STRATEGY A: FRACTAL MOMENTUM (TREND FOLLOWING) ===
  *   **Logic**: Enter when Price bounces off a Key Level in the direction of the Structure.
  *   **Trigger**:
      1.  **Level Test**: Price touches/nears 4H/1H/5m EMA 200, VWAP, or White Zone Limit.
      2.  **Reaction**: 1m/5m Pinbar, Engulfing, or Rejection Candle.
      3.  **Volume**: Volume spike on the reaction candle.

  === STRATEGY B: MEAN REVERSION (RANGE) ===
  *   **Logic**: Fade the extremes of the Range.
  *   **Trigger**: Bollinger Band Tag + RSI Extreme + Horizontal S/R Level.
  
  === SAFETY RULES ===
  1.  **Do NOT Buy Resistance / Sell Support**: Check distance to next Major Level.
  2.  **RR Ratio >= 1.5**: Distance to Target > 1.5 * Distance to Stop.
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
    Structure: ${indicators.h4.ema50 > indicators.h4.ema200 ? 'BULLISH (Golden Cross)' : 'BEARISH (Death Cross)'}
    
    [1 Hour]
    EMA 50: ${indicators.h1.ema50.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200: ${indicators.h1.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Swing High/Low: $${indicators.h1.struct.high.toLocaleString()} / $${indicators.h1.struct.low.toLocaleString()}
    ADX: ${indicators.h1.adx.toFixed(1)}
    Structure: ${indicators.h1.ema50 > indicators.h1.ema200 ? 'BULLISH (Golden Cross)' : 'BEARISH (Death Cross)'}

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
    1.  **Identify Trend Structure**: 
        - IGNORE Price position relative to EMA 50.
        - **Look ONLY at EMA 50 vs EMA 200 alignment.**
        - 50 > 200 = Bullish. 50 < 200 = Bearish.
    2.  **Identify Key Levels (S/R)**:
        - Where is the nearest Support? (EMA 200, VWAP, White Zone Lower, Swing Low)
        - Where is the nearest Resistance? (EMA 200, VWAP, White Zone Upper, Swing High)
    3.  **Plan Setup**:
        - **BULLISH Bias**: Wait for Price to hit a Support Level -> Buy Confirmation.
        - **BEARISH Bias**: Wait for Price to hit a Resistance Level -> Sell Confirmation.
        - **RANGE Bias**: Sell Resistance, Buy Support.
    4.  **Validate Setup (MANDATORY)**:
        - **Placement**: TP and SL MUST be attached to a specific Structural Level (e.g., EMA 200, Swing High).
        - **Stop Loss (SL)**: Must be BEHIND a Support/Resistance level AND > $500 from entry.
        - **Take Profit (TP)**: Must be AT next Support/Resistance level AND > $1000 from entry.
        - **Risk:Reward**: Prioritize setups with RR >= 1.5.
        - If conditions not met, output ACTION: "STAY".
    5.  **Output**: Action, Confidence, Strategy.

    ### RESPONSE FORMAT (JSON)
    {
      "action": "LONG" | "SHORT" | "STAY" | "CLOSE" | "ADD" | "UPDATE_SL" | "HOLD",
      "strategy_used": "TREND_A" | "RANGE_B",
      "reason": "Explain Structure (Cross), S/R Level tested, and Entry Trigger.",
      "confidence": Number (0-100),
      "stopLoss": Number,
      "takeProfit": Number,
      "riskPerTrade": Number,
      "setup_reason": "You MUST cite the S/R Level used. Do NOT say 'placed above entry'. Say 'SL placed above 4H Swing High ($88,500) which is >$500 away'.",
      "next_setup": {
        "short_level": Number, // IF BEARISH BIAS: Set to next resistance level. IF BULLISH: MUST BE 0.
        "long_level": Number,  // IF BULLISH BIAS: Set to next support level. IF BEARISH: MUST BE 0.
        "comment": "Plan for the PRIMARY BIAS ONLY. Stop hallucinating counter-trend setups."
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
