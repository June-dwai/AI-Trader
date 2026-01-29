
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface Trade {
    id: number;
    closed_at: string;
    side: string;
    entry_price: number;
    pnl: number;
    size: number;
}

export default function TradeHistory() {
    const [trades, setTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(true);

    const fetchTrades = useCallback(async () => {
        const { data } = await supabase
            .from('trades')
            .select('*')
            .eq('status', 'CLOSED')
            .order('closed_at', { ascending: false })
            .limit(10);

        if (data) setTrades(data as Trade[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        fetchTrades();

        // Subscribe to trade updates
        const channel = supabase
            .channel('trades-history')
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'trades', filter: "status=eq.CLOSED" }, () => {
                fetchTrades();
            })
            .subscribe();

        return () => { supabase.removeChannel(channel); };
    }, [fetchTrades]);

    if (loading) return <div className="text-gray-500 text-sm">Loading history...</div>;

    if (trades.length === 0) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 h-40 flex flex-col items-center justify-center text-center opacity-60">
                <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-2">No Trades Yet</h3>
                <p className="text-gray-600 text-sm">Waiting for the first completed trade...</p>
            </div>
        );
    }

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50 flex justify-between items-center">
                <h3 className="text-gray-400 text-sm font-bold">Recent Trades</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                    <thead className="text-xs text-gray-500 bg-gray-900 uppercase">
                        <tr>
                            <th className="px-4 py-3">Time</th>
                            <th className="px-4 py-3">Side</th>
                            <th className="px-4 py-3">Price</th>
                            <th className="px-4 py-3">Size</th>
                            <th className="px-4 py-3 text-right">PnL</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                        {trades.map((trade) => {
                            const isWin = trade.pnl >= 0;
                            return (
                                <tr key={trade.id} className="hover:bg-gray-800/50 transition-colors">
                                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                        {format(new Date(trade.closed_at), 'MM/dd HH:mm')}
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${trade.side === 'LONG' ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'}`}>
                                            {trade.side}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 font-mono text-gray-300 text-xs">
                                        <div className="flex flex-col">
                                            <span>In:  ${trade.entry_price.toLocaleString()}</span>
                                            <span>Out: ${(trade.entry_price + (trade.pnl / trade.size) * (trade.side === 'LONG' ? 1 : -1)).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                            {/* Corrected Out Price Logic: Entry + (PnL/Size) for Long, Entry - (PnL/Size) [handled by negative PnL? No, PnL is absolute value? No Pnl is signed.] 
                                                Actually, PnL = (Exit - Entry) * Size * Side(1 or -1)
                                                Exit - Entry = PnL / (Size * Side)
                                                Exit = Entry + PnL / (Size * Side)
                                                If Side=SHORT(-1), Exit = Entry + PnL / (-Size) = Entry - PnL/Size. 
                                                Wait, if PnL is negative (Loss) for Short:
                                                Entry=100, Exit=110. PnL = (100-110)*1*(-1) = -10*-1 = +10?? No.
                                                Short PnL = (Entry - Exit) * Size.
                                                PnL/Size = Entry - Exit.
                                                Exit = Entry - (PnL/Size).
                                                
                                                Long PnL = (Exit - Entry) * Size.
                                                PnL/Size = Exit - Entry.
                                                Exit = Entry + (PnL/Size).
                                                
                                                So:
                                                Long: Entry + PnL/Size
                                                Short: Entry - PnL/Size
                                            */}
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                        {trade.size?.toFixed(4)} BTC
                                    </td>
                                    <td className={`px-4 py-3 text-right font-bold font-mono ${isWin ? 'text-green-400' : 'text-red-400'}`}>
                                        {isWin ? '+' : ''}{trade.pnl?.toFixed(2)}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
