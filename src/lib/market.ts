
import axios from 'axios';
import { getBitcoinCandles as getBinanceCandles } from './binance';

// Weights
const WEIGHT_BINANCE = 0.6;
const WEIGHT_BYBIT = 0.4;

export interface MarketData {
    price: number;
    fundingRate: number;
    openInterest: number; // In BTC
}

async function getBinanceData(): Promise<MarketData> {
    try {
        const [tickerRes, fundingRes, oiRes] = await Promise.all([
            axios.get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT'),
            axios.get('https://fapi.binance.com/fapi/v1/premiumIndex?symbol=BTCUSDT'),
            axios.get('https://fapi.binance.com/fapi/v1/openInterest?symbol=BTCUSDT')
        ]);

        // Binance funding is usually annual or 8h? Premium Index 'lastFundingRate' is the current interval one
        return {
            price: parseFloat(tickerRes.data.price),
            fundingRate: parseFloat(fundingRes.data.lastFundingRate),
            openInterest: parseFloat(oiRes.data.openInterest) // Usually in BTC amount for Binance? Check docs. "openInterest": "0.554" (quantity)
        };
    } catch (e) {
        console.error("Binance Fetch Error", e);
        return { price: 0, fundingRate: 0, openInterest: 0 };
    }
}

async function getBybitData(): Promise<MarketData> {
    try {
        // Bybit V5 API
        const [tickerRes, oiRes] = await Promise.all([
            axios.get('https://api.bybit.com/v5/market/tickers?category=linear&symbol=BTCUSDT'),
            axios.get('https://api.bybit.com/v5/market/open-interest?category=linear&symbol=BTCUSDT&intervalTime=5min&limit=1')
        ]);

        const ticker = tickerRes.data?.result?.list?.[0];
        const oi = oiRes.data?.result?.list?.[0];

        if (!ticker || !oi) {
            console.warn("Bybit Data Missing:", {
                ticker: tickerRes.data,
                oi: oiRes.data
            });
            return { price: 0, fundingRate: 0, openInterest: 0 };
        }

        return {
            price: parseFloat(ticker.lastPrice),
            fundingRate: parseFloat(ticker.fundingRate),
            openInterest: parseFloat(oi.openInterest)
        };
    } catch (e) {
        console.error("Bybit Fetch Error", e);
        return { price: 0, fundingRate: 0, openInterest: 0 };
    }
}

export async function getAggregatedMarketData(): Promise<MarketData> {
    const [binance, bybit] = await Promise.all([getBinanceData(), getBybitData()]);

    // Handle errors: if one fails, use the other 100%
    if (binance.price === 0) return bybit;
    if (bybit.price === 0) return binance;

    return {
        price: (binance.price * WEIGHT_BINANCE) + (bybit.price * WEIGHT_BYBIT),
        fundingRate: (binance.fundingRate * WEIGHT_BINANCE) + (bybit.fundingRate * WEIGHT_BYBIT),
        openInterest: binance.openInterest + bybit.openInterest // Sum of liquidity
    };
}

export { getBinanceCandles as getCandles }; // Re-export candle fetcher
export async function getMultiFrameCandles() {
    // We already have this in binance.ts, we can reuse or wrap it here
    const { getMultiFrameCandles } = await import('./binance');
    return getMultiFrameCandles();
}
