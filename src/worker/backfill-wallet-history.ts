
import './init';
import { supabaseAdmin } from '../lib/supabase';
import { getBitcoinPrice } from '../lib/binance';
import axios from 'axios';

interface Trade {
    id: number;
    closed_at: string;
    pnl: number | null;
    status: string;
}

async function getBTCPriceAtTime(timestamp: number): Promise<number> {
    try {
        // Binance Klines API로 과거 BTC 가격 조회
        const response = await axios.get('https://fapi.binance.com/fapi/v1/klines', {
            params: {
                symbol: 'BTCUSDT',
                interval: '1h',
                startTime: timestamp - 3600000, // 1시간 전
                endTime: timestamp,
                limit: 1
            }
        });

        if (response.data.length > 0) {
            return parseFloat(response.data[0][4]); // Close price
        }

        // Fallback: try to get current price
        console.warn(`⚠️ No historical price found for ${new Date(timestamp).toISOString()}, using current price`);
        return await getBitcoinPrice();
    } catch (error) {
        console.error('Error fetching BTC price:', error);
        return await getBitcoinPrice();
    }
}

async function backfillWalletHistory() {
    console.log('📊 Starting wallet history backfill...\n');

    // Get all closed trades, sorted by date
    const { data: trades, error: tradesError } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('status', 'CLOSED')
        .order('closed_at', { ascending: true });

    if (tradesError) {
        console.error('❌ Error fetching trades:', tradesError);
        return;
    }

    if (!trades || trades.length === 0) {
        console.log('⚠️ No closed trades found');
        return;
    }

    console.log(`✅ Found ${trades.length} closed trades\n`);

    let balance = 1000; // Initial balance
    const historyRecords = [];

    // Initial record (1 day before first trade)
    const firstTradeTime = new Date(trades[0].closed_at).getTime();
    let initialBtcPrice: number;

    try {
        initialBtcPrice = await getBTCPriceAtTime(firstTradeTime);
    } catch {
        initialBtcPrice = await getBitcoinPrice();
    }

    historyRecords.push({
        timestamp: new Date(firstTradeTime - 86400000).toISOString(), // 1 day before first trade
        balance: 1000,
        btc_price: initialBtcPrice,
        daily_pnl: 0,
        daily_return_pct: 0
    });

    console.log(`📅 Initial record: ${new Date(firstTradeTime - 86400000).toISOString()}`);
    console.log(`💰 Initial balance: 1000 USDT`);
    console.log(`₿ Initial BTC price: $${initialBtcPrice.toFixed(2)}\n`);

    let prevBalance = balance;
    let prevDate = new Date(trades[0].closed_at).toDateString();

    // Process each trade
    for (let i = 0; i < trades.length; i++) {
        const trade = trades[i];
        const pnl = trade.pnl || 0;
        balance += pnl;

        const tradeTime = new Date(trade.closed_at);
        const tradeDate = tradeTime.toDateString();

        let btcPrice: number;
        try {
            btcPrice = await getBTCPriceAtTime(tradeTime.getTime());
        } catch {
            btcPrice = await getBitcoinPrice();
        }

        let dailyPnl = null;
        let dailyReturnPct = null;

        if (tradeDate !== prevDate) {
            // New day
            dailyPnl = balance - prevBalance;
            dailyReturnPct = prevBalance !== 0 ? (dailyPnl / prevBalance) * 100 : 0;
            prevBalance = balance;
            prevDate = tradeDate;
        }

        historyRecords.push({
            timestamp: trade.closed_at,
            balance: balance,
            btc_price: btcPrice,
            daily_pnl: dailyPnl,
            daily_return_pct: dailyReturnPct
        });

        const pnlSign = pnl >= 0 ? '+' : '';
        console.log(`[${i + 1}/${trades.length}] ${tradeTime.toISOString()}: ${balance.toFixed(2)} USDT (PnL: ${pnlSign}${pnl.toFixed(2)}, BTC: $${btcPrice.toFixed(2)})`);

        // Rate limit: 1 request per second to avoid API limits
        if (i < trades.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1100));
        }
    }

    console.log(`\n📝 Inserting ${historyRecords.length} records into wallet_history...`);

    // Insert all records
    const { error } = await supabaseAdmin
        .from('wallet_history')
        .insert(historyRecords);

    if (error) {
        console.error('❌ Error inserting history:', error);
    } else {
        console.log(`✅ Successfully backfilled ${historyRecords.length} records`);
        console.log(`\n📊 Summary:`);
        console.log(`   Initial Balance: 1000 USDT`);
        console.log(`   Final Balance: ${balance.toFixed(2)} USDT`);
        console.log(`   Total PnL: ${(balance - 1000).toFixed(2)} USDT`);
        console.log(`   Total Return: ${((balance - 1000) / 1000 * 100).toFixed(2)}%`);
    }
}

backfillWalletHistory()
    .then(() => {
        console.log('\n✅ Backfill complete');
        process.exit(0);
    })
    .catch(err => {
        console.error('❌ Backfill failed:', err);
        process.exit(1);
    });
