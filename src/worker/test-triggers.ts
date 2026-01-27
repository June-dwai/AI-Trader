
import './init';
import { supabaseAdmin } from '../lib/supabase';
import { monitorActivePositions } from './trader';
import axios from 'axios';

async function testTriggers() {
    console.log("--- STARTING TP/SL TRIGGER TEST ---");

    // 1. Get Current Price
    const { data: priceData } = await axios.get('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
    const currentPrice = parseFloat(priceData.price);
    console.log(`Current Price: $${currentPrice}`);

    // 2. Insert Test Trades (Designed to Trigger IMMEDIATELY)

    // Case A: Long Take Profit (Entry < TP < Price)
    // Actual Logic: TP is triggered if Price >= TP.
    // So if Price is 90000. Set TP = 89000.
    const tpTrade = {
        symbol: 'BTCUSDT',
        side: 'LONG',
        entry_price: currentPrice - 200,
        leverage: 1,
        size: 0.001,
        status: 'OPEN',
        take_profit: currentPrice - 50, // Price is HIGHER than TP -> Trigger
        stop_loss: currentPrice - 1000
    };

    // Case B: Long Stop Loss (Entry > Price > SL wrong... Entry > SL > Price)
    // Actual Logic: SL is triggered if Price <= SL.
    // So if Price is 90000. Set SL = 91000.
    const slTrade = {
        symbol: 'BTCUSDT',
        side: 'LONG',
        entry_price: currentPrice + 200,
        leverage: 1,
        size: 0.001,
        status: 'OPEN',
        take_profit: currentPrice + 1000,
        stop_loss: currentPrice + 50 // Price is LOWER than SL -> Trigger
    };

    console.log("Seeding Test Trades...");
    const { data: inserted, error } = await supabaseAdmin.from('trades').insert([tpTrade, slTrade]).select();

    if (error) {
        console.error("Failed to insert test trades:", error);
        return;
    }

    const tpId = inserted[0].id; // 1st one
    const slId = inserted[1].id; // 2nd one
    console.log(`Inserted TP Trade ID: ${tpId} (TP: ${tpTrade.take_profit})`);
    console.log(`Inserted SL Trade ID: ${slId} (SL: ${slTrade.stop_loss})`);

    // 3. Run Monitor
    console.log("Running Monitor Logic...");
    await monitorActivePositions();

    // 4. Verify Results
    console.log("Verifying Results...");
    const { data: results } = await supabaseAdmin.from('trades').select('*').in('id', [tpId, slId]);

    const tpResult = results?.find(t => t.id === tpId);
    const slResult = results?.find(t => t.id === slId);

    if (tpResult?.status === 'CLOSED') console.log(`✅ TP Trade Closed Successfully. PnL: ${tpResult.pnl}`);
    else console.error(`❌ TP Trade FAILED to Close. Status: ${tpResult?.status}`);

    if (slResult?.status === 'CLOSED') console.log(`✅ SL Trade Closed Successfully. PnL: ${slResult.pnl}`);
    else console.error(`❌ SL Trade FAILED to Close. Status: ${slResult?.status}`);

    console.log("--- TEST COMPLETE ---");
}

testTriggers();
