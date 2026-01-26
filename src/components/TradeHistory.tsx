
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
                                            <span>Out: ${(trade.entry_price * (1 + (trade.pnl / (trade.size * trade.entry_price)))).toLocaleString()}</span>
                                            {/* Note: Approx Exit Price calc for display if not stored */}
                                        </div>
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
