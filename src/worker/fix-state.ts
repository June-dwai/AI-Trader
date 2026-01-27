
import './init';
import { supabaseAdmin } from '../lib/supabase';

async function fixState() {
    console.log("--- STARTING DB FIX ---");

    // 1. Force Close All Open Trades
    const { data: openTrades, error: fetchError } = await supabaseAdmin
        .from('trades')
        .select('*')
        .eq('status', 'OPEN');

    if (fetchError) {
        console.error("Error fetching open trades:", fetchError);
    } else {
        console.log(`Found ${openTrades?.length} stuck open trades.`);

        for (const trade of openTrades || []) {
            console.log(`Force closing trade ${trade.id}...`);
            const { error: closeError } = await supabaseAdmin
                .from('trades')
                .update({
                    status: 'CLOSED',
                    closed_at: new Date().toISOString(),
                    pnl: 0 // Reset PnL to 0 for these stuck trades to avoid further damage
                })
                .eq('id', trade.id);

            if (closeError) console.error(`Failed to close trade ${trade.id}:`, closeError);
            else console.log(`Trade ${trade.id} closed.`);
        }
    }

    // 2. Reset Wallet Balance
    console.log("Resetting Wallet Balance...");
    const { data: wallet, error: walletError } = await supabaseAdmin
        .from('wallet')
        .select('*')
        .single();

    if (walletError || !wallet) {
        console.log("No wallet found, creating one...");
        await supabaseAdmin.from('wallet').insert({ balance: 1000 });
    } else {
        console.log(`Current Balance: ${wallet.balance}. Resetting to 1000.`);
        const { error: updateError } = await supabaseAdmin
            .from('wallet')
            .update({ balance: 1000 })
            .eq('id', wallet.id);

        if (updateError) console.error("Failed to reset wallet:", updateError);
        else console.log("Wallet reset to $1000.");
    }

    console.log("--- FIX COMPLETE ---");
}

fixState();
