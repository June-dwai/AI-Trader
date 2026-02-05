
'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { format } from 'date-fns';

interface Log {
    id: number;
    created_at: string;
    type: string;
    message: string;
    ai_response?: string;
}

type FilterType = 'ALL' | 'LONG' | 'SHORT' | 'STAY' | 'CLOSE' | 'HOLD';

export default function RealtimeLogs() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [loading, setLoading] = useState(false);
    const [filter, setFilter] = useState<FilterType>('ALL');

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('logs')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) {
            console.error("Error fetching logs:", error);
        }

        if (data) setLogs(data as Log[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchLogs();

        // Realtime subscription
        const channel = supabase
            .channel('logs-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'logs' }, (payload) => {
                setLogs(prev => [payload.new as Log, ...prev].slice(0, 20));
            })
            .subscribe();

        // Polling fallback
        const interval = setInterval(fetchLogs, 10000);

        return () => {
            supabase.removeChannel(channel);
            clearInterval(interval);
        };
    }, [fetchLogs]);

    // Filter logs by AI action type
    const filteredLogs = logs.filter(log => {
        if (filter === 'ALL') return true;
        if (!log.ai_response) return false;

        try {
            const data = JSON.parse(log.ai_response);
            return data.action === filter;
        } catch {
            return false;
        }
    });

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 min-h-96 max-h-[800px] overflow-y-auto font-mono text-sm flex flex-col resize-y">
            {/* Header with Filters */}
            <div className="pb-3 border-b border-gray-800 flex justify-between items-start gap-4">
                <div className="flex-1">
                    <h3 className="text-gray-400 mb-2">AI Activity Logs</h3>
                    <div className="flex gap-2 flex-wrap">
                        {(['ALL', 'LONG', 'SHORT', 'STAY', 'CLOSE', 'HOLD'] as FilterType[]).map(f => (
                            <button
                                key={f}
                                onClick={() => setFilter(f)}
                                className={`px-3 py-1 text-xs rounded transition-all ${filter === f
                                    ? 'bg-blue-600 text-white font-bold'
                                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                                    }`}
                            >
                                {f}
                            </button>
                        ))}
                    </div>
                </div>
                <button
                    onClick={fetchLogs}
                    disabled={loading}
                    className="px-3 py-1.5 text-xs bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors disabled:opacity-50 whitespace-nowrap"
                >
                    {loading ? '↻' : 'Refresh'}
                </button>
            </div>

            {/* Log List */}
            <div className="flex-1 overflow-y-auto space-y-3 mt-4">
                {filteredLogs.length === 0 ? (
                    <div className="text-center text-gray-600 py-8">
                        {filter === 'ALL' ? 'No logs yet' : `No ${filter} actions`}
                    </div>
                ) : (
                    filteredLogs.map((log) => (
                        <div key={log.id}>
                            {log.ai_response ? (
                                <AILogCard log={log} />
                            ) : (
                                <SimpleLogCard log={log} />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// Simple log card for non-AI logs
function SimpleLogCard({ log }: { log: Log }) {
    return (
        <div className="border-l-2 border-gray-600 pl-3 py-1">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>{format(new Date(log.created_at), 'HH:mm:ss')}</span>
                <span className={`px-1 rounded ${log.type === 'ERROR' ? 'bg-red-900 text-red-200' : 'bg-gray-800'}`}>
                    {log.type}
                </span>
            </div>
            <p className="text-gray-300 text-xs">{log.message}</p>
        </div>
    );
}

// Enhanced AI log card
function AILogCard({ log }: { log: Log }) {
    const [isExpanded, setIsExpanded] = useState(false);

    let data: AIData;
    try {
        data = JSON.parse(log.ai_response!);
    } catch {
        return <SimpleLogCard log={log} />;
    }

    const { action, confidence, reason, next_setup, stopLoss, takeProfit, setup_reason } = data;

    // Handle WARNING logs as REJECTED
    const isRejected = log.type === 'WARNING';
    const displayAction = isRejected ? 'REJECTED' : action;
    const style = ACTION_STYLES[displayAction as keyof typeof ACTION_STYLES] || ACTION_STYLES.STAY;

    return (
        <div className={`border-l-4 ${style.border} ${style.bg} rounded-r-lg overflow-hidden`}>
            {/* Card Header */}
            <div className="px-3 py-2 bg-gray-900/30">
                <div className="flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-base">{style.icon}</span>
                        <span className={`font-bold ${style.text} text-sm`}>{displayAction}</span>
                        {!isRejected && (
                            <>
                                <span className="text-gray-600">•</span>
                                <span className="text-gray-400 text-xs">{confidence}%</span>
                            </>
                        )}
                    </div>
                    <span className="text-gray-500 text-xs font-mono">
                        {format(new Date(log.created_at), 'HH:mm:ss')}
                    </span>
                </div>
                {/* Show rejection reason */}
                {isRejected && (
                    <div className="mt-1 text-xs text-orange-300">
                        ⚠️ {log.message}
                    </div>
                )}
            </div>

            {/* Card Content */}
            <div className="px-3 py-2 space-y-2">
                {/* Entry Reason - Only show when NOT expanded */}
                {!isExpanded && (
                    <div className="text-xs text-gray-300 leading-relaxed">
                        {reason.split('\n')[0]}
                    </div>
                )}

                {/* TP/SL Levels - Only show if values are greater than 0 */}
                {((takeProfit ?? 0) > 0 || (stopLoss ?? 0) > 0) && (
                    <div className="flex gap-2 text-[10px] font-mono">
                        {(takeProfit ?? 0) > 0 && (
                            <div className="flex-1 bg-green-900/20 border border-green-900/30 rounded px-2 py-1">
                                <div className="text-green-400 font-bold">TP</div>
                                <div className="text-white">${takeProfit!.toLocaleString()}</div>
                            </div>
                        )}
                        {(stopLoss ?? 0) > 0 && (
                            <div className="flex-1 bg-red-900/20 border border-red-900/30 rounded px-2 py-1">
                                <div className="text-red-400 font-bold">SL</div>
                                <div className="text-white">${stopLoss!.toLocaleString()}</div>
                            </div>
                        )}
                    </div>
                )}

                {/* Watch Levels (for STAY) - Only show if there are non-zero values */}
                {next_setup && (next_setup.short_level > 0 || next_setup.long_level > 0) && (
                    <div className="text-[10px] font-mono text-gray-400 flex justify-between">
                        {next_setup.short_level > 0 && (
                            <span className="text-red-400">SHORT @ ${next_setup.short_level.toLocaleString()}</span>
                        )}
                        {next_setup.long_level > 0 && (
                            <span className="text-green-400">LONG @ ${next_setup.long_level.toLocaleString()}</span>
                        )}
                    </div>
                )}

                {/* Expand/Collapse Button */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="text-[10px] text-gray-500 hover:text-gray-300 transition-colors flex items-center gap-1 mt-1"
                >
                    {isExpanded ? '▲' : '▼'} {isExpanded ? 'Hide' : 'Show'} Details
                </button>
            </div>

            {/* Expanded Details */}
            {isExpanded && (
                <div className="px-3 pb-3 space-y-2 border-t border-gray-800/50 pt-2">
                    {/* Full Analysis */}
                    <div>
                        <div className="text-[10px] text-gray-500 font-bold mb-1 uppercase tracking-wider">
                            Full Analysis
                        </div>
                        <p className="text-xs text-gray-300 leading-relaxed whitespace-pre-wrap">
                            {reason}
                        </p>
                    </div>

                    {/* Setup Reason */}
                    {setup_reason && (
                        <div className="bg-blue-900/10 p-2 rounded border border-blue-900/30">
                            <div className="text-[10px] text-blue-400 font-bold mb-1">Entry Logic</div>
                            <p className="text-xs text-blue-100">{setup_reason}</p>
                        </div>
                    )}

                    {/* Strategy Outlook */}
                    {next_setup?.comment && (
                        <div className="bg-gray-800/50 p-2 rounded border border-gray-700">
                            <div className="text-[10px] text-gray-400 font-bold mb-1">Strategy Outlook</div>
                            <p className="text-xs text-gray-300 italic">{next_setup.comment}</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Action styling configuration
const ACTION_STYLES = {
    LONG: {
        border: 'border-green-500',
        bg: 'bg-green-900/10',
        text: 'text-green-400',
        icon: '🟢'
    },
    SHORT: {
        border: 'border-red-500',
        bg: 'bg-red-900/10',
        text: 'text-red-400',
        icon: '🔴'
    },
    STAY: {
        border: 'border-gray-500',
        bg: 'bg-gray-900/10',
        text: 'text-gray-400',
        icon: '⚪'
    },
    CLOSE: {
        border: 'border-yellow-500',
        bg: 'bg-yellow-900/10',
        text: 'text-yellow-400',
        icon: '💰'
    },
    HOLD: {
        border: 'border-blue-500',
        bg: 'bg-blue-900/10',
        text: 'text-blue-400',
        icon: '🔵'
    },
    ADD: {
        border: 'border-purple-500',
        bg: 'bg-purple-900/10',
        text: 'text-purple-400',
        icon: '🟣'
    },
    UPDATE_SL: {
        border: 'border-orange-500',
        bg: 'bg-orange-900/10',
        text: 'text-orange-400',
        icon: '🟠'
    },
    REJECTED: {
        border: 'border-orange-600',
        bg: 'bg-orange-900/20',
        text: 'text-orange-400',
        icon: '❌'
    }
};

interface AIData {
    action: string;
    confidence: number;
    reason: string;
    next_setup?: { comment: string; short_level: number; long_level: number };
    stopLoss?: number;
    takeProfit?: number;
    setup_reason?: string;
}
