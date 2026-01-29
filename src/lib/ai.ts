
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
  === TRADING RULES (CRITICAL) ===

  **RULE 1: Identify Market Structure**
  1. Check H4/H1 EMA alignment:
     - EMA 50 > EMA 200 = BULLISH BIAS (only look for longs)
     - EMA 50 < EMA 200 = BEARISH BIAS (only look for shorts)

  **RULE 2: Identify Price Location**  
  2. Where is price relative to key levels?
     - BULLISH BIAS: Wait for pullback to Support (H1/5m EMA 200, VWAP, Swing Low)
     - BEARISH BIAS: Wait for retracement to Resistance (H1/5m EMA 200, VWAP, Swing High)

  **RULE 3: Micro Confirmation (White Zone)**
  3. Use 1m White Zone Status as CONFIRMATION only:
     - BULLISH BIAS + Price bouncing from Support + WZ = UPTREND → Consider LONG
     - BEARISH BIAS + Price rejecting from Resistance + WZ = DOWNTREND → Consider SHORT
     - If WZ = CHOP or CHOP_RUBBING → STAY (too noisy, avoid trading)

  **RULE 4: Stop Loss Placement**
  - LONG: SL must be BELOW the support level by at least $500
  - SHORT: SL must be ABOVE the resistance level by at least $500

  **RULE 5: Take Profit Placement**  
  - TP must target the NEXT major S/R level
  - Minimum distance: $1000 from entry
  - Minimum R:R ratio: 1.5:1

  **CRITICAL WARNING**
  - DO NOT enter trades just because price "touches" White Zone bands
  - White Zone is NOT a simple support/resistance - it's a TREND FILTER
  - Always verify the actual price position before making decisions
`;

export interface ActivePositionSummary {
  side: string;
  entry_price: number;
  size: number;
  pnl_percent: string;
  tp_price?: number;
  sl_price?: number;
}

export async function getAiDecision(
  indicators: ReturnType<typeof calculateIndicators>,
  marketData: MarketData,
  oiHistory: number[],
  fundingHistory: number[],
  previousDecision: TradeDecision | null,
  recentTrades: string,
  activePosition: ActivePositionSummary | null // Current Open Trade Details
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

    ### RECENT TRADING HISTORY (CRITICAL FOR LEARNING)
    ${recentTrades}

    *** ANTI-REVENGE TRADING RULES ***
    1. If last 2+ trades were LOSSES in the SAME direction → AVOID that direction for next 2 cycles
    2. If recent win rate < 40% → Increase confidence threshold to 80%
    3. NEVER enter the same direction immediately after a loss without strong confirmation
    4. If unsure, choosing STAY is ALWAYS better than forcing a trade
    5. Review the trading history CAREFULLY before making any decision

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
    VWAP (Intraday S/R): $${indicators.m5.vwap.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    EMA 200: $${indicators.m5.ema200.toLocaleString('en-US', { maximumFractionDigits: 0 })}
    Swing High/Low: $${indicators.m5.struct.high.toLocaleString()} / $${indicators.m5.struct.low.toLocaleString()}
    RSI: ${indicators.m5.rsi.toFixed(1)}

    [1 Minute - White Zone (Trend Band)]
    Status: ${indicators.m1.whiteZone.status}
    Upper Band: $${indicators.m1.whiteZone.upper.toFixed(0)}
    Lower Band: $${indicators.m1.whiteZone.lower.toFixed(0)}
    Current Price: $${indicators.m1.currentPrice.toFixed(2)}

    *** CRITICAL WHITE ZONE INTERPRETATION ***
    - UPTREND: Price trading ABOVE both bands → Bullish momentum confirmed
    - DOWNTREND: Price trading BELOW both bands → Bearish momentum confirmed
    - CHOP: Price oscillating WITHIN the bands → No clear trend, use caution
    - CHOP_RUBBING: Avoid trading - High noise, multiple false signals

    DO NOT use White Zone as simple Support/Resistance touch points!
    Use it to CONFIRM the micro trend direction only.

    ### ACTIVE POSITION
    ${activePosition
      ? `HOLDING ${activePosition.side} | Entry: $${activePosition.entry_price} | PnL: ${activePosition.pnl_percent}% | TP: $${activePosition.tp_price || 'None'} | SL: $${activePosition.sl_price || 'None'}`
      : "NO POSITION"
    }

    ### DECISION PROCESS (Step-by-Step)

    STEP 1: Check Market Structure
    - Look at H4/H1 EMA 50 vs EMA 200 alignment
    - Is it Golden Cross (50>200) or Death Cross (50<200)?
    - Record: BULLISH BIAS or BEARISH BIAS

    STEP 2: Locate Price Position
    - Current price: $${marketData.price.toFixed(2)}
    - If BULLISH BIAS: List distances to Support levels (5m EMA 200, H1 EMA 200, VWAP, Swing Low)
    - If BEARISH BIAS: List distances to Resistance levels (5m EMA 200, H1 EMA 200, VWAP, Swing High)
    - Is price ALREADY AT or NEAR a key level (within $300)?

    STEP 3: Check White Zone Status
    - What is the 1m WZ status?
    - UPTREND/DOWNTREND = Trend confirmation available
    - CHOP/CHOP_RUBBING = NO TRADE (too risky, wait for clarity)

    STEP 4: Validate Setup (for NEW trades only)
    - Entry: Is price at a key S/R level RIGHT NOW?
    - SL: Must be $500+ away, placed BEHIND the structural level
    - TP: Must be $1000+ away, targeting the NEXT major S/R level
    - R:R: Calculate distance to TP / distance to SL. Must be >= 1.5

    STEP 5: Make Decision
    - IF all conditions met + WZ confirms → LONG or SHORT (confidence >= 70)
    - IF waiting for price to reach setup level → STAY (explain what level you're waiting for)
    - IF holding position → HOLD, CLOSE, or UPDATE_SL (explain current status)

    ### CRITICAL: Price vs White Zone Reality Check
    Before making ANY decision, verify the actual numbers:
    - Current Price: $${marketData.price.toFixed(2)}
    - WZ Upper Band: $${indicators.m1.whiteZone.upper.toFixed(0)}
    - WZ Lower Band: $${indicators.m1.whiteZone.lower.toFixed(0)}
    - Actual relationship: 
      * If price > upper → Above WZ (UPTREND zone)
      * If price < lower → Below WZ (DOWNTREND zone)
      * If lower < price < upper → Inside WZ (CHOP zone)

    DO NOT say "price touched WZ upper" if the numbers show price is below it!
    Always state the actual price values in your reasoning.

    ### RESPONSE FORMAT (JSON)
    {
      "action": "LONG" | "SHORT" | "STAY" | "CLOSE" | "ADD" | "UPDATE_SL" | "HOLD",
      "strategy_used": "TREND_A" | "RANGE_B",
      "reason": "Explain Structure (Cross) and S/R Level.",
      "confidence": Number (0-100),
      "stopLoss": Number, // IF HOLDING: Current SL. IF NEW: Proposed SL.
      "takeProfit": Number, // IF HOLDING: Current TP. IF NEW: Proposed TP.
      "riskPerTrade": Number,
      "setup_reason": "IF HOLDING: Explain management (e.g. 'Holding as price is above EMA'). IF NEW: Explain TP/SL placement citing S/R levels.",
      "next_setup": {
        "short_level": Number, // Set to 0 if Bullish
        "long_level": Number,  // Set to 0 if Bearish
        "comment": "IF HOLDING: 'Monitoring for exit/add'. IF NEW: Plan for Primary Bias."
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
