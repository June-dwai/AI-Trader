
import { EMA, RSI, ADX, ATR, VWAP } from 'technicalindicators';
import { Candle } from './binance';

export interface TimeframeIndicators {
    currentPrice: number;
    ema20: number;
    ema50: number;
    ema100: number;
    ema200: number;
    rsi: number;
    adx: number;
    atr: number;
    vwap: number;
    volume: number;
    whiteZone: {
        status: string;
        upper: number;
        lower: number;
    };
    struct: {
        high: number;
        low: number;
    };
}

function calculateTFIndicators(candles: Candle[]): TimeframeIndicators {
    const closePrices = candles.map(c => c.close);
    const highPrices = candles.map(c => c.high);
    const lowPrices = candles.map(c => c.low);
    const volumes = candles.map(c => c.volume);

    const ema20 = EMA.calculate({ period: 20, values: closePrices });
    const ema50 = EMA.calculate({ period: 50, values: closePrices });
    const ema100 = EMA.calculate({ period: 100, values: closePrices });
    const ema200 = EMA.calculate({ period: 200, values: closePrices });

    // EMA 2000 for White Zone (Only if enough data)
    let ema2000: number[] = [];
    if (closePrices.length >= 2000) {
        ema2000 = EMA.calculate({ period: 2000, values: closePrices });
    }

    const rsi = RSI.calculate({ period: 14, values: closePrices });
    const adx = ADX.calculate({ period: 14, high: highPrices, low: lowPrices, close: closePrices });
    const atr = ATR.calculate({ period: 14, high: highPrices, low: lowPrices, close: closePrices });

    // --- WHITE ZONE CALCULATION (1m Special) ---
    // Requires EMA 2000. If not available, default to 'UNKNOWN'.
    let whiteZoneStatus = 'UNKNOWN';
    let whiteZoneUpper = 0;
    let whiteZoneLower = 0;

    if (ema2000.length > 0 && ema20.length > 0 && atr.length > 0) {
        const currentEma20 = ema20[ema20.length - 1];
        const currentEma2000 = ema2000[ema2000.length - 1];
        const currentAtr = atr[atr.length - 1];

        // Def: Line Upper (Avg) = (1m EMA 20 + 1m EMA 2000) / 2
        whiteZoneUpper = (currentEma20 + currentEma2000) / 2;
        // Def: Line Lower (Minus) = Line Upper - (1.0 * 1m ATR)
        whiteZoneLower = whiteZoneUpper - (1.0 * currentAtr);

        // State Check
        const lastClose = closePrices[closePrices.length - 1];
        const lastOpen = candles[candles.length - 1].open; // Need to access candle open
        const bodyTop = Math.max(lastOpen, lastClose);
        const bodyBottom = Math.min(lastOpen, lastClose);
        const zoneMax = Math.max(whiteZoneUpper, whiteZoneLower);
        const zoneMin = Math.min(whiteZoneUpper, whiteZoneLower);

        // a. Uptrend: Body completely ABOVE lines
        if (bodyBottom > zoneMax) {
            whiteZoneStatus = 'UPTREND';
        }
        // b. Downtrend: Body completely BELOW lines
        else if (bodyTop < zoneMin) {
            whiteZoneStatus = 'DOWNTREND';
        }
        // c. Default Chop
        else {
            whiteZoneStatus = 'CHOP';
        }

        // d. Rubbing Check (Last 240 mins)
        // Check "Cross/Touch" count on 5m basis.
        // We look back 240 minutes = 48 intervals of 5m.
        // We sample every 5th 1m candle to approximate 5m checks.
        const lookbackMinutes = 240;
        let touchCount = 0;
        let samples = 0;
        const startIndex = Math.max(0, candles.length - lookbackMinutes);

        // Iterate only every 5th candle to simulate 5m timeframe check
        for (let i = startIndex; i < candles.length; i += 5) {
            // Map 'i' (input index) to indicator array indices
            const idxEma20 = i - (20 - 1);
            const idxEma2000 = i - (2000 - 1);
            const idxAtr = i - (14 - 1);

            if (idxEma20 >= 0 && idxEma2000 >= 0 && idxAtr >= 0) {
                samples++;
                const valEma20 = ema20[idxEma20];
                const valEma2000 = ema2000[idxEma2000];
                const valAtr = atr[idxAtr];

                const up = (valEma20 + valEma2000) / 2;
                const down = up - valAtr;

                // For 5m 'Touch', we ideally want the High/Low of the 5m period.
                // We can look at the 5 candles [i, i+4] to find 5m High/Low.
                let periodHigh = -Infinity;
                let periodLow = Infinity;
                for (let j = 0; j < 5 && (i + j) < highPrices.length; j++) {
                    periodHigh = Math.max(periodHigh, highPrices[i + j]);
                    periodLow = Math.min(periodLow, lowPrices[i + j]);
                }

                const zMax = Math.max(up, down);
                const zMin = Math.min(up, down);

                // Touch/Cross condition: Low <= Max AND High >= Min
                if (periodLow <= zMax && periodHigh >= zMin) {
                    touchCount++;
                }
            }
        }

        if (touchCount >= 24) {
            whiteZoneStatus = `CHOP_RUBBING (${touchCount}/${samples} touches)`;
        }
    }

    // --- SWING POINTS (FRACTALS) ---
    // Simple 5-candle Fractal (High > 2 left & 2 right)
    // We scan backwards from end-3 (since we need 2 future candles to confirm)
    let recentStructHigh = 0;
    let recentStructLow = 0;

    for (let i = candles.length - 3; i >= 2; i--) {
        const h = highPrices[i];
        const l = lowPrices[i];

        // Fractal High
        if (recentStructHigh === 0) {
            if (h > highPrices[i - 1] && h > highPrices[i - 2] && h > highPrices[i + 1] && h > highPrices[i + 2]) {
                recentStructHigh = h;
            }
        }
        // Fractal Low
        if (recentStructLow === 0) {
            if (l < lowPrices[i - 1] && l < lowPrices[i - 2] && l < lowPrices[i + 1] && l < lowPrices[i + 2]) {
                recentStructLow = l;
            }
        }
        if (recentStructHigh !== 0 && recentStructLow !== 0) break;
    }


    const vwapInput = {
        high: highPrices,
        low: lowPrices,
        close: closePrices,
        volume: volumes
    };
    const vwap = VWAP.calculate(vwapInput);

    return {
        currentPrice: closePrices[closePrices.length - 1],
        ema20: ema20[ema20.length - 1] || 0,
        ema50: ema50[ema50.length - 1] || 0,
        ema100: ema100[ema100.length - 1] || 0,
        ema200: ema200[ema200.length - 1] || 0,
        rsi: rsi[rsi.length - 1] || 0,
        adx: adx[adx.length - 1]?.adx || 0,
        atr: atr[atr.length - 1] || 0,
        vwap: vwap[vwap.length - 1] || 0,
        volume: volumes[volumes.length - 1],
        whiteZone: {
            status: whiteZoneStatus,
            upper: whiteZoneUpper,
            lower: whiteZoneLower
        },
        struct: {
            high: recentStructHigh || Math.max(...highPrices.slice(-20)), // Fallback to 20-period high
            low: recentStructLow || Math.min(...lowPrices.slice(-20))     // Fallback to 20-period low
        }
    };
}

export function calculateIndicators(candlesMap: { m1: Candle[], m5: Candle[], h1: Candle[], h4: Candle[], d1: Candle[] }) {
    // Pass D1 high/low/close/vol for Macro VWAP approximation if needed, though strictly we use H1/H4 for trends
    return {
        m1: calculateTFIndicators(candlesMap.m1),
        m5: calculateTFIndicators(candlesMap.m5),
        h1: calculateTFIndicators(candlesMap.h1),
        h4: calculateTFIndicators(candlesMap.h4),
        d1: calculateTFIndicators(candlesMap.d1),
    };
}
