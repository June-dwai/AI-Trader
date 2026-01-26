import { NextResponse } from 'next/server';
import { getBitcoinCandles } from '@/lib/binance';
import { EMA, ATR, VWAP } from 'technicalindicators';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        // Fetch 500 candles for 5m timeframe (primary view)
        // We also need enough history for EMA2000 (White Zone) if we want to be accurate.
        // White Zone is defined on 1m, but user might want to see it on 5m chart? 
        // Or we show 1m chart? The bot trades on 5m signals mostly, but White Zone is 1m.
        // Let's fetch 1m candles (2500) to compute White Zone, then maybe aggregate or just return 1m data for the chart.
        // Displaying 1m chart is better for "Microstructure" bot.

        // Fetch 1m candles (6000 to cover EMA 2000 and provide history)
        const candles = await getBitcoinCandles('1m', 6000);

        // We can reuse the existing calculator logic, but we need the arrays directly.

        const closes = candles.map(c => c.close);
        const highs = candles.map(c => c.high);
        const lows = candles.map(c => c.low);
        const volumes = candles.map(c => c.volume);

        const ema20 = EMA.calculate({ period: 20, values: closes });
        const ema200 = EMA.calculate({ period: 200, values: closes });
        const ema2000 = EMA.calculate({ period: 2000, values: closes });
        const atr = ATR.calculate({ period: 14, high: highs, low: lows, close: closes });
        const vwap = VWAP.calculate({ high: highs, low: lows, close: closes, volume: volumes });

        // Align Arrays
        const chartData = candles.map((c, i) => {
            // Calculate White Zone for this point
            // Need specific index for each indicator
            const idxEma20 = i - (20 - 1);
            const idxEma200 = i - (200 - 1);
            const idxEma2000 = i - (2000 - 1);
            const idxAtr = i - (14 - 1);
            const idxVwap = i; // VWAP usually matches length if calculated on whole series

            let whiteZone = null;
            let valEma200 = null;
            let valVwap = null;

            if (idxEma20 >= 0 && idxEma2000 >= 0 && idxAtr >= 0) {
                // Safe check
                if (ema20[idxEma20] && ema2000[idxEma2000] && atr[idxAtr]) {
                    const valEma20 = ema20[idxEma20];
                    const valEma2000 = ema2000[idxEma2000];
                    const valAtr = atr[idxAtr];

                    const upper = (valEma20 + valEma2000) / 2;
                    const lower = upper - valAtr;

                    whiteZone = { upper, lower };
                }
            }

            if (idxEma200 >= 0 && ema200[idxEma200]) {
                valEma200 = ema200[idxEma200];
            }
            if (vwap[idxVwap]) {
                valVwap = vwap[idxVwap];
            }

            return {
                time: c.openTime / 1000, // Unix Timestamp
                open: c.open,
                high: c.high,
                low: c.low,
                close: c.close,
                whiteZone,
                ema200: valEma200,
                vwap: valVwap
            };
        });

        // Return last 2880 points (48 Hours of 1m data)
        const slicedData = chartData.slice(-2880);

        return NextResponse.json(slicedData);
    } catch (error) {
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
