
'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

export default function RealtimeLogs() {
    const [logs, setLogs] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    const fetchLogs = async () => {
        setLoading(true);
        const { data } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);
        if (data) setLogs(data);
        setLoading(false);
    };

    useEffect(() => {
        fetchLogs();

        // Realtime subscription (Backup)
        const channel = supabase
            .channel('logs-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
                setLogs(prev => [payload.new, ...prev].slice(0, 20));
            })
            .subscribe();

        // Polling (Primary fallback)
        const interval = setInterval(fetchLogs, 10000); // 10s auto-refresh

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, []);

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 h-96 overflow-y-auto font-mono text-sm relative">
            <div className="sticky top-0 bg-gray-900 pb-2 border-b border-gray-800 flex justify-between items-center z-10">
                <h3 className="text-gray-400">AI Activity Logs</h3>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="px-2 py-1 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors flex items-center gap-1 disabled:opacity-50"
                >
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>
            <div className="space-y-3 mt-4">
                {logs.map((log) => (
                    <div key={log.id} className="border-l-2 border-blue-500 pl-3 py-1">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                            <span>{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                            <span className={`px-1 rounded ${log.type === 'ERROR' ? 'bg-red-900 text-red-200' : 'bg-gray-800'}`}>{log.type}</span>
                        </div>
                        <p className="text-gray-300 mb-1">{log.message}</p>
                        {log.ai_response && <AIReasoningViewer responseStr={log.ai_response} />}
                    </div>
                ))}
            </div>
        </div>
    );
}

function AIReasoningViewer({ responseStr }: { responseStr: string }) {
    let data;
    try {
        data = JSON.parse(responseStr);
    } catch {
        return <div className="text-xs text-red-500">Failed to parse AI response</div>;
    }

    const { action, confidence, reason, next_setup, stopLoss, takeProfit, setup_reason } = data;

    const borderColor = action === 'LONG' ? 'border-green-500'
        : action === 'SHORT' ? 'border-red-500'
            : 'border-gray-600';

    const textColor = action === 'LONG' ? 'text-green-400'
        : action === 'SHORT' ? 'text-red-400'
            : 'text-gray-400';

    return (
        <details className="mt-2 border border-gray-800 bg-gray-950/50 rounded-lg overflow-hidden group">
            <summary className="px-3 py-2 text-xs flex items-center justify-between cursor-pointer hover:bg-gray-900 transition-colors select-none">
                <div className="flex items-center gap-2">
                    <span className={`font-bold ${textColor}`}>{action}</span>
                    <span className="text-gray-600">|</span>
                    <span className="text-gray-400">{confidence}% Confidence</span>
                </div>
                <span className="text-gray-600 group-open:rotate-180 transition-transform">▼</span>
            </summary>

            <div className={`p-3 border-t border-gray-800 text-xs text-gray-300 space-y-3 border-l-2 ${borderColor}`}>
                {/* Main Reason */}
                <div>
                    <span className="block text-gray-500 font-bold mb-1 uppercase tracking-wider">Analysis</span>
                    <p className="leading-relaxed whitespace-pre-wrap">{reason}</p>
                </div>

                {/* Setup Reason (If Entry) */}
                {setup_reason && (
                    <div className="bg-blue-900/10 p-2 rounded border border-blue-900/30">
                        <span className="block text-blue-400 font-bold mb-1">Entry Logic</span>
                        <p className="text-blue-100">{setup_reason}</p>
                    </div>
                )}

                {/* Trade Params (If Entry) */}
                {(stopLoss || takeProfit) && (
                    <div className="grid grid-cols-2 gap-2">
                        <div className="bg-red-900/10 p-2 rounded border border-red-900/30">
                            <span className="block text-red-400 font-bold">Stop Loss</span>
                            <span><strong>${stopLoss?.toLocaleString()}</strong></span>
                        </div>
                        <div className="bg-green-900/10 p-2 rounded border border-green-900/30">
                            <span className="block text-green-400 font-bold">Take Profit</span>
                            <span><strong>${takeProfit?.toLocaleString()}</strong></span>
                        </div>
                    </div>
                )}

                {/* Watch Levels (If STAY) */}
                {next_setup && (
                    <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                        <span className="block text-gray-400 font-bold mb-1">Strategy Outlook</span>
                        <p className="mb-2 italic opacity-80">{next_setup.comment}</p>
                        <div className="flex justify-between text-[10px] uppercase font-mono mt-2">
                            <span className="text-red-400">Short @ ${next_setup.short_level}</span>
                            <span className="text-green-400">Long @ ${next_setup.long_level}</span>
                        </div>
                    </div>
                )}
            </div>
        </details>
    );
}
