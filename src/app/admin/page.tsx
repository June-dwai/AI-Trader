'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface Trade {
    id: number;
    symbol: string;
    side: string;
    entry_price: number;
    size: number;
    leverage: number;
    take_profit?: number;
    stop_loss?: number;
    created_at: string;
}

export default function AdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [openTrades, setOpenTrades] = useState<Trade[]>([]);
    const [loading, setLoading] = useState(false);
    const [currentPrice, setCurrentPrice] = useState(0);

    useEffect(() => {
        if (isAuthenticated) {
            fetchOpenTrades();
            fetchCurrentPrice();
            const interval = setInterval(() => {
                fetchOpenTrades();
                fetchCurrentPrice();
            }, 5000);
            return () => clearInterval(interval);
        }
    }, [isAuthenticated]);

    const fetchOpenTrades = async () => {
        try {
            const response = await fetch('/api/admin/trades');
            const result = await response.json();
            if (result.success) {
                setOpenTrades(result.trades || []);
            }
        } catch (error) {
            console.error('Failed to fetch trades:', error);
        }
    };

    const fetchCurrentPrice = async () => {
        const res = await fetch('https://fapi.binance.com/fapi/v1/ticker/price?symbol=BTCUSDT');
        const data = await res.json();
        setCurrentPrice(parseFloat(data.price));
    };

    const handleLogin = (e: React.FormEvent) => {
        e.preventDefault();
        // Simple password check (use environment variable in production)
        if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD || password === 'admin123') {
            setIsAuthenticated(true);
        } else {
            alert('Incorrect password');
        }
    };

    const handleClosePosition = async (tradeId: number) => {
        if (!confirm('Are you sure you want to close this position?')) return;

        setLoading(true);
        try {
            const response = await fetch('/api/admin/close-position', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ tradeId, currentPrice })
            });

            const result = await response.json();
            if (result.success) {
                alert(`Position closed successfully! PnL: $${result.pnl.toFixed(2)}`);
                fetchOpenTrades();
            } else {
                alert(`Error: ${result.error}`);
            }
        } catch (error) {
            alert(`Error: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const calculateUnrealizedPnL = (trade: Trade) => {
        const grossPnl = (currentPrice - trade.entry_price) * trade.size * (trade.side === 'LONG' ? 1 : -1);
        const entryFee = trade.entry_price * trade.size * 0.0004;
        const exitFee = currentPrice * trade.size * 0.0004;
        return grossPnl - entryFee - exitFee;
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-8 max-w-md w-full">
                    <h1 className="text-2xl font-bold text-white mb-6 text-center">Admin Access</h1>
                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-gray-400 text-sm mb-2">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-gray-800 border border-gray-700 rounded px-4 py-2 text-white focus:outline-none focus:border-blue-500"
                                placeholder="Enter admin password"
                                autoFocus
                            />
                        </div>
                        <button
                            type="submit"
                            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors"
                        >
                            Login
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black p-4">
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-4">
                        <a
                            href="/"
                            className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded font-bold transition-colors flex items-center gap-2"
                        >
                            ← Home
                        </a>
                        <h1 className="text-3xl font-bold text-white">Admin Control Panel</h1>
                    </div>
                    <div className="text-right">
                        <div className="text-gray-400 text-sm">Current BTC Price</div>
                        <div className="text-2xl font-bold text-white">${currentPrice.toLocaleString()}</div>
                    </div>
                </div>

                <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
                    <div className="px-4 py-3 border-b border-gray-800 bg-gray-900/50">
                        <h2 className="text-gray-400 text-sm font-bold">Open Positions ({openTrades.length})</h2>
                    </div>

                    {openTrades.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            No open positions
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="text-xs text-gray-500 bg-gray-900 uppercase">
                                    <tr>
                                        <th className="px-4 py-3 text-left">ID</th>
                                        <th className="px-4 py-3 text-left">Side</th>
                                        <th className="px-4 py-3 text-left">Entry</th>
                                        <th className="px-4 py-3 text-left">Size</th>
                                        <th className="px-4 py-3 text-left">Leverage</th>
                                        <th className="px-4 py-3 text-left">TP / SL</th>
                                        <th className="px-4 py-3 text-right">Unrealized PnL</th>
                                        <th className="px-4 py-3 text-center">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-800">
                                    {openTrades.map((trade) => {
                                        const pnl = calculateUnrealizedPnL(trade);
                                        const isProfitable = pnl >= 0;
                                        return (
                                            <tr key={trade.id} className="hover:bg-gray-800/50 transition-colors">
                                                <td className="px-4 py-3 text-gray-400 font-mono">#{trade.id}</td>
                                                <td className="px-4 py-3">
                                                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${trade.side === 'LONG'
                                                        ? 'bg-green-900/20 text-green-400'
                                                        : 'bg-red-900/20 text-red-400'
                                                        }`}>
                                                        {trade.side}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-gray-300 font-mono">
                                                    ${trade.entry_price.toLocaleString()}
                                                </td>
                                                <td className="px-4 py-3 text-gray-300 font-mono">
                                                    {trade.size.toFixed(4)} BTC
                                                </td>
                                                <td className="px-4 py-3 text-gray-300 font-mono">
                                                    {trade.leverage}x
                                                </td>
                                                <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                                                    <div>TP: ${trade.take_profit?.toLocaleString() || 'N/A'}</div>
                                                    <div>SL: ${trade.stop_loss?.toLocaleString() || 'N/A'}</div>
                                                </td>
                                                <td className={`px-4 py-3 text-right font-bold font-mono ${isProfitable ? 'text-green-400' : 'text-red-400'
                                                    }`}>
                                                    {isProfitable ? '+' : ''}{pnl.toFixed(2)}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <button
                                                        onClick={() => handleClosePosition(trade.id)}
                                                        disabled={loading}
                                                        className="bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white text-xs font-bold px-4 py-2 rounded transition-colors"
                                                    >
                                                        {loading ? 'Closing...' : 'Close'}
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

                <div className="mt-4 text-center text-gray-600 text-sm">
                    🔒 Admin-only page • Positions refresh every 5 seconds
                </div>
            </div>
        </div>
    );
}
