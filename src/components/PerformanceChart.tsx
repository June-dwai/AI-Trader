'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { supabase } from '@/lib/supabase';

type ChartTab = 'balance' | 'vsBTC' | 'dailyPnl' | 'dailyReturn';

interface WalletHistoryData {
    timestamp: string;
    balance: number;
    btc_price: number;
    daily_pnl: number | null;
    daily_return_pct: number | null;
}

interface ChartDataPoint {
    date: string;
    balance: number;
    usdtReturn: number;
    btcReturn: number;
    alpha: number;
    dailyPnl: number;
    dailyReturn: number;
}

export default function PerformanceChart() {
    const [data, setData] = useState<WalletHistoryData[]>([]);
    const [activeTab, setActiveTab] = useState<ChartTab>('balance');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();

        // Realtime subscription
        const channel = supabase
            .channel('wallet-history-channel')
            .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wallet_history' }, () => {
                fetchData();
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    async function fetchData() {
        setLoading(true);
        const { data: walletHistory } = await supabase
            .from('wallet_history')
            .select('*')
            .order('timestamp', { ascending: true });

        if (walletHistory) {
            setData(walletHistory);
        }
        setLoading(false);
    }

    // Calculate vs BTC returns and prepare chart data
    const chartData: ChartDataPoint[] = data.map((d, index) => {
        const initialBtc = data[0]?.btc_price || 1;
        const initialBalance = 1000;

        const btcReturn = ((d.btc_price - initialBtc) / initialBtc) * 100;
        const usdtReturn = ((d.balance - initialBalance) / initialBalance) * 100;
        const alpha = usdtReturn - btcReturn;

        // Use timestamp with time to ensure unique keys
        const dateObj = new Date(d.timestamp);
        const dateLabel = dateObj.toLocaleDateString('ko-KR', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        return {
            date: dateLabel,
            balance: d.balance,
            usdtReturn: usdtReturn,
            btcReturn: btcReturn,
            alpha: alpha,
            dailyPnl: d.daily_pnl || 0,
            dailyReturn: d.daily_return_pct || 0
        };
    });

    const tabs: { id: ChartTab; name: string }[] = [
        { id: 'balance', name: '자산 추이(USDT)' },
        { id: 'vsBTC', name: 'vs BTC(%)' },
        { id: 'dailyPnl', name: '일간 수익(USDT)' },
        { id: 'dailyReturn', name: '일간 수익(%)' }
    ];

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
            <h2 className="text-xl font-bold text-white mb-4">📊 Performance Analysis</h2>

            {/* Tabs */}
            <div className="flex gap-2 mb-6 flex-wrap">
                {tabs.map(tab => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        className={`px-4 py-2 rounded text-sm font-medium transition-all ${activeTab === tab.id
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                            }`}
                    >
                        {tab.name}
                    </button>
                ))}
            </div>

            {/* Chart */}
            {loading ? (
                <div className="h-96 flex items-center justify-center text-gray-500">
                    Loading...
                </div>
            ) : chartData.length === 0 ? (
                <div className="h-96 flex items-center justify-center text-gray-500">
                    No data available. Complete some trades first.
                </div>
            ) : (
                <ResponsiveContainer width="100%" height={400}>
                    {activeTab === 'balance' && (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#E5E7EB' }}
                                itemStyle={{ color: '#10B981' }}
                            />
                            <Line type="monotone" dataKey="balance" stroke="#10B981" strokeWidth={2} dot={false} name="Balance (USDT)" />
                        </LineChart>
                    )}

                    {activeTab === 'vsBTC' && (
                        <LineChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#E5E7EB' }}
                                formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(2)}%` : 'N/A'}
                            />
                            <Line type="monotone" dataKey="usdtReturn" stroke="#10B981" strokeWidth={2} dot={false} name="Portfolio (%)" />
                            <Line type="monotone" dataKey="btcReturn" stroke="#EF4444" strokeWidth={2} dot={false} name="BTC (%)" />
                        </LineChart>
                    )}

                    {activeTab === 'dailyPnl' && (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#E5E7EB' }}
                            />
                            <Bar
                                dataKey="dailyPnl"
                                name="Daily PnL (USDT)"
                                radius={[4, 4, 0, 0]}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.dailyPnl >= 0 ? '#10B981' : '#EF4444'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    )}

                    {activeTab === 'dailyReturn' && (
                        <BarChart data={chartData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis dataKey="date" stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <YAxis stroke="#9CA3AF" style={{ fontSize: '12px' }} />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelStyle={{ color: '#E5E7EB' }}
                                formatter={(value: number | undefined) => value !== undefined ? `${value.toFixed(2)}%` : 'N/A'}
                            />
                            <Bar
                                dataKey="dailyReturn"
                                name="Daily Return (%)"
                                radius={[4, 4, 0, 0]}
                            >
                                {chartData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.dailyReturn >= 0 ? '#10B981' : '#EF4444'}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    )}
                </ResponsiveContainer>
            )}
        </div>
    );
}
