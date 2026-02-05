import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const { tradeId, currentPrice } = await request.json();

        if (!tradeId || !currentPrice) {
            return NextResponse.json({ success: false, error: 'Missing tradeId or currentPrice' }, { status: 400 });
        }

        // Fetch the trade
        const { data: trade, error: fetchError } = await supabaseAdmin
            .from('trades')
            .select('*')
            .eq('id', tradeId)
            .eq('status', 'OPEN')
            .single();

        if (fetchError || !trade) {
            return NextResponse.json({ success: false, error: 'Trade not found or already closed' }, { status: 404 });
        }

        // Calculate PnL with fees
        const grossPnl = (currentPrice - trade.entry_price) * trade.size * (trade.side === 'LONG' ? 1 : -1);
        const entryFee = trade.entry_price * trade.size * 0.0004;
        const exitFee = currentPrice * trade.size * 0.0004;
        const totalFees = entryFee + exitFee;
        const netPnl = grossPnl - totalFees;

        // Close the trade
        const { error: updateError } = await supabaseAdmin
            .from('trades')
            .update({
                status: 'CLOSED',
                pnl: netPnl,
                closed_at: new Date().toISOString()
            })
            .eq('id', tradeId);

        if (updateError) {
            return NextResponse.json({ success: false, error: updateError.message }, { status: 500 });
        }

        // Update wallet
        const { data: wallet } = await supabaseAdmin.from('wallet').select('id, balance').single();
        if (wallet) {
            const newBalance = wallet.balance + netPnl;
            await supabaseAdmin.from('wallet').update({
                balance: newBalance
            }).eq('id', wallet.id);

            // Record wallet history
            const { data: prevHistory } = await supabaseAdmin
                .from('wallet_history')
                .select('balance, timestamp')
                .order('timestamp', { ascending: false })
                .limit(1)
                .single();

            let dailyPnl = null;
            let dailyReturnPct = null;

            if (prevHistory) {
                const prevDate = new Date(prevHistory.timestamp).toDateString();
                const currDate = new Date().toDateString();

                if (prevDate !== currDate) {
                    // New day - calculate daily metrics
                    dailyPnl = newBalance - prevHistory.balance;
                    dailyReturnPct = prevHistory.balance !== 0 ? (dailyPnl / prevHistory.balance) * 100 : 0;
                }
            }

            await supabaseAdmin.from('wallet_history').insert({
                timestamp: new Date().toISOString(),
                balance: newBalance,
                btc_price: currentPrice,
                daily_pnl: dailyPnl,
                daily_return_pct: dailyReturnPct
            });

            console.log(`📊 Wallet history recorded (manual close): ${newBalance.toFixed(2)} USDT @ BTC ${currentPrice.toFixed(2)}`);
        }

        // Log the manual close
        await supabaseAdmin.from('logs').insert({
            type: 'INFO',
            message: `Admin manually closed Trade #${tradeId}. Net PnL: $${netPnl.toFixed(2)}`
        });

        return NextResponse.json({
            success: true,
            pnl: netPnl,
            grossPnl,
            fees: totalFees
        });

    } catch (error) {
        console.error('Close position error:', error);
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
