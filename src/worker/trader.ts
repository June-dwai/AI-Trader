
import './init';
import axios from 'axios';

import { getAggregatedMarketData } from '../lib/market';
import { getMultiFrameCandles } from '../lib/binance';
import { calculateIndicators } from '../lib/indicators';
import { getAiDecision } from '../lib/ai';
import { supabaseAdmin } from '../lib/supabase';
import { sendTelegramMessage } from '../lib/telegram';

async function runTrader() {
    console.log('--- Starting Trader Bot v2.0 (Microstructure) ---', new Date().toISOString());

    try {
        // 1. Fetch Aggregated Market Data & Candles
        const marketData = await getAggregatedMarketData();
        const candleMap = await getMultiFrameCandles();

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
            try { previousDecision = JSON.parse(lastLog.ai_response); } catch { }
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
                pnl_percent: (currentPnlPercent * 100).toFixed(2),
                tp_price: t.take_profit,
                sl_price: t.stop_loss
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
                if (error) console.error("Add Trade Error", error);
            }
            else if (decision.action === 'UPDATE_SL') {
                console.log(`🛡️ Moving Stop Loss to: ${decision.stopLoss}`);
                // In a real app, update 'sl_price' column. Here just log.
            }

        } else {
            // Entry Logic (Only if NO active trade)
            if (['LONG', 'SHORT'].includes(decision.action) && decision.confidence >= 70) {
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
                    status: 'OPEN',
                    stop_loss: decision.stopLoss,
                    take_profit: decision.takeProfit
                });

                if (error) console.error("Trade Insert Error", error);
                else {
                    console.log(`Trade Opened! Size: ${sizeBTC.toFixed(4)} BTC, Risk: ${(riskPerTrade * 100).toFixed(1)}%`);

                    // --- TELEGRAM NOTIFICATION ---
                    const emoji = decision.action === 'LONG' ? '🟢' : '🔴';
                    const msg = `🚀 *AI TRADER SIGNAL* 🚀\n\n` +
                        `Action: *${decision.action}* ${emoji}\n` +
                        `Entry: $${price.toLocaleString()}\n` +
                        `Target: $${decision.takeProfit.toLocaleString()}\n` +
                        `Stop: $${decision.stopLoss.toLocaleString()}\n\n` +
                        `Confidence: ${decision.confidence}%\n` +
                        `Reason: ${decision.setup_reason || decision.reason}`;

                    await sendTelegramMessage(msg);
                }
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

// 6. Real-time TP/SL Monitor (Runs frequently)
export async function monitorActivePositions() {
    try {
        const { data: activeTrades } = await supabaseAdmin.from('trades').select('*').eq('status', 'OPEN');
        if (!activeTrades || activeTrades.length === 0) return;

        const { data: priceData } = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
        const currentPrice = parseFloat(priceData.price);

        for (const trade of activeTrades) {
            let triggered = false;
            let type = '';
            let pnl = 0;

            // Check Long
            if (trade.side === 'LONG') {
                if (trade.take_profit && currentPrice >= trade.take_profit) { triggered = true; type = 'TAKE_PROFIT'; }
                else if (trade.stop_loss && currentPrice <= trade.stop_loss) { triggered = true; type = 'STOP_LOSS'; }
            }
            // Check Short
            else if (trade.side === 'SHORT') {
                if (trade.take_profit && currentPrice <= trade.take_profit) { triggered = true; type = 'TAKE_PROFIT'; }
                else if (trade.stop_loss && currentPrice >= trade.stop_loss) { triggered = true; type = 'STOP_LOSS'; }
            }

            if (triggered) {
                pnl = (currentPrice - trade.entry_price) * trade.size * (trade.side === 'LONG' ? 1 : -1);
                console.log(`⚡ ${type} TRIGGERED for Trade ${trade.id} @ $${currentPrice}`);

                // Close Trade
                const { error: updateError } = await supabaseAdmin.from('trades').update({
                    status: 'CLOSED',
                    pnl: pnl,
                    closed_at: new Date().toISOString()
                    // exit_reason: type // Removed: Column might not exist
                }).eq('id', trade.id);

                if (updateError) {
                    console.error(`Failed to close trade ${trade.id}:`, updateError);
                    continue; // Skip wallet update if trade didn't close
                }

                // Update Wallet
                const { data: wallet } = await supabaseAdmin.from('wallet').select('id, balance').single();
                if (wallet) {
                    await supabaseAdmin.from('wallet').update({ balance: wallet.balance + pnl }).eq('id', wallet.id);
                }

                // Telegram Notify
                const emoji = pnl > 0 ? '💰' : '🛑';
                const msg = `${emoji} *TRADE CLOSED (${type})* ${emoji}\n\n` +
                    `Action: ${trade.side}\n` +
                    `Entry: $${trade.entry_price.toLocaleString()}\n` +
                    `Close: $${currentPrice.toLocaleString()}\n` +
                    `PnL: $${pnl.toFixed(2)}`;

                await sendTelegramMessage(msg);
            }
        }
    } catch (e) {
        console.error("Monitor Error:", e);
    }
}

runTrader();
setInterval(runTrader, 5 * 60 * 1000); // AI Logic (5 min)
setInterval(monitorActivePositions, 10 * 1000); // TP/SL Check (10 sec)
