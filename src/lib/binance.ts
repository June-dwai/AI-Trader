
import axios from 'axios';

const BASE_URL = 'https://fapi.binance.com';

export interface Candle {
    openTime: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export async function getBitcoinPrice(): Promise<number> {
    const response = await axios.get(`${BASE_URL}/fapi/v1/ticker/price`, {
        params: { symbol: 'BTCUSDT' }
    });
    return parseFloat(response.data.price);
}

export async function getBitcoinCandles(interval: string = '15m', count: number = 200): Promise<Candle[]> {
    let gatheredCandles: Candle[] = [];
    let remaining = count;
    let endTime: number | undefined = undefined;

    while (remaining > 0) {
        // Binance FAPI limit is 1500 per request. Safe chunk size 1000.
        const limit = Math.min(remaining, 1000);

        const params: Record<string, string | number> = {
            symbol: 'BTCUSDT',
            interval: interval,
            limit: limit
        };
        if (endTime) {
            params.endTime = endTime;
        }

        try {
            const response = await axios.get(`${BASE_URL}/fapi/v1/klines`, { params });
            const data = response.data;

            if (!data || data.length === 0) break;

            const candles = data.map((d: (string | number)[]) => ({
                openTime: Number(d[0]),
                open: parseFloat(String(d[1])),
                high: parseFloat(String(d[2])),
                low: parseFloat(String(d[3])),
                close: parseFloat(String(d[4])),
                volume: parseFloat(String(d[5])),
            }));

            // Prepend because we are fetching backwards (endTime)
            gatheredCandles = [...candles, ...gatheredCandles];

            // Update endTime to be the openTime of the first candle in this batch - 1ms
            endTime = candles[0].openTime - 1;
            remaining -= candles.length;

            if (candles.length < limit) break; // No more data available

        } catch (error) {
            console.error(`Error fetching candles for ${interval}:`, error);
            break;
        }
    }

    // Return the requested count (trim from start if we got slightly more due to overlap logic, though here we prepend)
    // Actually with the logic above, we prepend. If we needed 2000, we asked for 1000 (latest), then 1000 (before that).
    // gatheredCandles checks out.
    return gatheredCandles;
}

export async function getMultiFrameCandles() {
    const promises = [
        getBitcoinCandles('1m', 2500), // Request 2500 for EMA2000 + Rubbing Check
        getBitcoinCandles('5m', 500),
        getBitcoinCandles('1h', 500),
        getBitcoinCandles('4h', 200),
        getBitcoinCandles('1d', 100)
    ];
    const results = await Promise.all(promises);

    return {
        m1: results[0],
        m5: results[1],
        h1: results[2],
        h4: results[3],
        d1: results[4]
    };
}
