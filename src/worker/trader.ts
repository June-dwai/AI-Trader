
import './init';

import { getAggregatedMarketData, getCandles } from '../lib/market';
import { calculateIndicators } from '../lib/indicators';
import { getAiDecision } from '../lib/ai';
import { supabaseAdmin } from '../lib/supabase';

// Helper to fetch multi-frame using the renamed import
async function fetchMultiFrameCandles() {
    const intervals = ['1m', '5m', '1h', '4h', '1d'];
    // We use getCandles (which is getBitcoinCandles from binance.ts)
    const promises = intervals.map(i => getCandles(i, 200));
    const results = await Promise.all(promises);
    return {
        m1: results[0],
        m5: results[1],
        h1: results[2],
        h4: results[3],
        d1: results[4]
    };
}

async function runTrader() {
    console.log('--- Starting Trader Bot v2.0 (Microstructure) ---', new Date().toISOString());

    try {
        // 1. Fetch Aggregated Market Data & Candles
        const marketData = await getAggregatedMarketData();
        const candleMap = await fetchMultiFrameCandles();

        // 2. Calculate Enhanced Indicators
        const indicators = calculateIndicators(candleMap);

        const price = marketData.price;

        // Fetch previous logs to calculate OI History (Last 30m ~ 6 logs)
        const { data: recentLogs } = await supabaseAdmin
            .from('logs')
            .select('market_data, ai_response')
            .eq('type', 'INFO')
            .order('created_at', { ascending: false })
            .limit(6); // Fetch last 6 entries

        const oiHistory = recentLogs?.map(log => log.market_data.oi).reverse() || [];
        // Add current OI to history for latest context
        oiHistory.push(marketData.openInterest);

        const fundingHistory = recentLogs?.map(log => log.market_data.funding).reverse() || [];
        fundingHistory.push(marketData.fundingRate);

        const lastLog = recentLogs?.[0]; // The most recent previous log

        const previousOi = lastLog?.market_data?.oi || marketData.openInterest;
        const oiChangePercent = ((marketData.openInterest - previousOi) / previousOi) * 100;

        let previousDecision = null;
        if (lastLog?.ai_response) {
            try { previousDecision = JSON.parse(lastLog.ai_response); } catch (e) { }
        }

        // Fetch recent closed trades for Self-Reflection
        const { data: closedTrades } = await supabaseAdmin
            .from('trades')
            .select('*')
            .eq('status', 'CLOSED')
            .order('closed_at', { ascending: false })
            .limit(5);

        let recentTradesSummary = "No recent closed trades.";
        if (closedTrades && closedTrades.length > 0) {
            const wins = closedTrades.filter(t => t.pnl > 0).length;
            const losses = closedTrades.filter(t => t.pnl <= 0).length;
            recentTradesSummary = `Last ${closedTrades.length} Trades: ${wins} Wins, ${losses} Losses. History: ` +
                closedTrades.map(t => `${t.side} (${t.pnl > 0 ? 'WIN' : 'LOSS'} $${t.pnl.toFixed(2)})`).join(', ');
        }

        console.log(`Aggregated Price: $${price.toFixed(2)} | Funding: ${marketData.fundingRate.toFixed(5)}% | OI: ${marketData.openInterest.toFixed(2)} BTC (Change: ${oiChangePercent.toFixed(4)}%)`);

        // 3. fetch Active Positions
        const { data: activeTrades } = await supabaseAdmin
            .from('trades')
            .select('*')
            .eq('status', 'OPEN');

        // 4. Prepare AI Context
        let activePosition = null;
        if (activeTrades && activeTrades.length > 0) {
            const t = activeTrades[0];
            const currentPnlPercent = t.side === 'LONG'
                ? ((price - t.entry_price) / t.entry_price) * t.leverage
                : ((t.entry_price - price) / t.entry_price) * t.leverage;
            activePosition = {
                side: t.side,
                entry_price: t.entry_price,
                size: t.size,
                pnl_percent: (currentPnlPercent * 100).toFixed(2)
            };
        }

        // 4. Ask AI (v3.0 - Management & Entry)
        const decision = await getAiDecision(indicators, marketData, oiHistory, fundingHistory, previousDecision, recentTradesSummary, activePosition);
        console.log(`AI Decision: ${decision.action} (${decision.confidence}%) - ${decision.reason}`);

        // Log to DB
        await supabaseAdmin.from('logs').insert({
            type: 'INFO',
            message: `Checked Market. Action: ${decision.action} (${decision.confidence}%)`,
            ai_response: JSON.stringify(decision),
            market_data: {
                price,
                funding: marketData.fundingRate,
                oi: marketData.openInterest,
                vwap: indicators.m5.vwap
            }
        });

        // 5. Execute AI Decision
        if (activeTrades && activeTrades.length > 0) {
            const trade = activeTrades[0];

            // Management Logic
            if (decision.action === 'CLOSE') {
                // Fee Calculation (Approximate)
                const PNL = (price - trade.entry_price) * trade.size * (trade.side === 'LONG' ? 1 : -1);
                console.log(`Closing Trade ${trade.id}. PnL: ${PNL.toFixed(2)}`);
                await supabaseAdmin.from('trades').update({
                    status: 'CLOSED',
                    pnl: PNL,
                    closed_at: new Date().toISOString()
                }).eq('id', trade.id);

                // Update Wallet
                const { data: wallet } = await supabaseAdmin.from('wallet').select('id, balance').single();
                if (wallet) {
                    await supabaseAdmin.from('wallet').update({ balance: wallet.balance + PNL }).eq('id', wallet.id);
                }
            }
            else if (decision.action === 'ADD') {
                console.log(`🔥 PYRAMIDING! Adding to position ${trade.id}`);
                // Simple implementation: Open a secondary trade
                const { data: wallet } = await supabaseAdmin.from('wallet').select('balance').single();
                const balance = wallet?.balance || 1000;
                const riskAmount = balance * 0.01; // Conservative 1% add
                // Logic to insert new trade...
                const { error } = await supabaseAdmin.from('trades').insert({
                    symbol: 'BTCUSDT',
                    side: decision.action === 'ADD' ? trade.side : decision.action, // Inherit side
                    entry_price: price,
                    leverage: trade.leverage, // Keep same leverage
                    size: (riskAmount / price), // Small size
                    status: 'OPEN'
                });
            }
            else if (decision.action === 'UPDATE_SL') {
                console.log(`🛡️ Moving Stop Loss to: ${decision.stopLoss}`);
                // In a real app, update 'sl_price' column. Here just log.
            }

        } else {
            // Entry Logic (Only if NO active trade)
            if (['LONG', 'SHORT'].includes(decision.action) && decision.confidence > 75) {
                // Fetch Wallet
                const { data: wallet } = await supabaseAdmin.from('wallet').select('balance').single();
                const balance = wallet?.balance || 1000;

                const riskPerTrade = decision.riskPerTrade || 0.02; // Default 2%
                const slPrice = decision.stopLoss;
                const slDistancePercent = Math.abs(price - slPrice) / price;
                const safeSlDistance = Math.max(slDistancePercent, 0.01);
                let tradeAmountUSDT = (balance * riskPerTrade) / safeSlDistance;
                const maxBuyingPower = balance * LEVERAGE_DYNAMIC(indicators.m5.atr, price);
                tradeAmountUSDT = Math.min(tradeAmountUSDT, maxBuyingPower);
                const sizeBTC = tradeAmountUSDT / price;

                const { error } = await supabaseAdmin.from('trades').insert({
                    symbol: 'BTCUSDT',
                    side: decision.action,
                    entry_price: price,
                    leverage: LEVERAGE_DYNAMIC(indicators.m5.atr, price),
                    size: sizeBTC,
                    status: 'OPEN'
                });

                if (error) console.error("Trade Insert Error", error);
                else console.log(`Trade Opened! Size: ${sizeBTC.toFixed(4)} BTC, Risk: ${(riskPerTrade * 100).toFixed(1)}%`);
            }
        }

        return;


    } catch (e) {
        console.error("Worker Error:", e);
        await supabaseAdmin.from('logs').insert({ type: 'ERROR', message: String(e) });
    }
}

// Dynamic Leverage Calculation based on Volatility
function LEVERAGE_DYNAMIC(atr: number, price: number): number {
    const volatilityPercent = atr / price;
    if (volatilityPercent < 0.005) return 20; // Low Volatility -> 20x
    if (volatilityPercent < 0.01) return 10;  // Medium -> 10x
    return 5;                                 // High Volatility -> 5x
}

runTrader();
setInterval(runTrader, 5 * 60 * 1000);
