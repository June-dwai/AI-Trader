
'use client';

import { useEffect, useState } from 'react';
import { getBitcoinPrice } from '@/lib/binance';

interface Trade {
    id: number;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entry_price: number;
    leverage: number;
    size: number;
    opened_at: string;
}

export default function ActivePosition({ trade }: { trade: Trade | null }) {
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const p = await getBitcoinPrice();
                setCurrentPrice(p);
            } catch (e) { console.error(e); }
        };
        fetchPrice();
        const interval = setInterval(fetchPrice, 5000);
        return () => clearInterval(interval);
    }, []);

    if (!trade) {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 h-48 flex flex-col items-center justify-center text-center opacity-60">
                <h3 className="text-gray-500 font-bold uppercase tracking-wider mb-2">No Active Position</h3>
                <p className="text-gray-600 text-sm">AI is analyzing the market...</p>
                {currentPrice && <p className="text-gray-700 font-mono text-xs mt-4">Current BTC: ${currentPrice.toLocaleString()}</p>}
            </div>
        );
    }

    if (!currentPrice) return <div className="animate-pulse h-48 bg-gray-900 border border-gray-800 rounded-2xl"></div>;

    const entryPrice = trade.entry_price;
    const leverage = trade.leverage;
    const isLong = trade.side === 'LONG';

    const pnlPercent = isLong
        ? ((currentPrice - entryPrice) / entryPrice) * leverage
        : ((entryPrice - currentPrice) / entryPrice) * leverage;

    const pnlValue = (trade.size * entryPrice) * pnlPercent;
    const isProfit = pnlValue >= 0;

    return (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 relative overflow-hidden">
            <div className={`absolute top-0 left-0 w-1 h-full ${isProfit ? 'bg-green-500' : 'bg-red-500'}`} />

            <div className="flex justify-between items-start mb-4">
                <div>
                    <h3 className="text-gray-400 text-sm font-bold uppercase tracking-wider">Active Position</h3>
                    <div className="flex items-center gap-2 mt-1">
                        <span className={`text-2xl font-bold ${isLong ? 'text-green-400' : 'text-red-400'}`}>
                            {trade.side} {trade.leverage}x
                        </span>
                        <span className="text-gray-500 text-sm">{trade.symbol}</span>
                    </div>
                </div>
                <div className={`px-3 py-1 rounded text-sm font-bold ${isProfit ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                    {isProfit ? 'PROFIT' : 'LOSS'}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                    <p className="text-gray-500">Entry Price</p>
                    <p className="text-white font-mono">${entryPrice.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-gray-500">Current Price</p>
                    <p className="text-white font-mono">${currentPrice.toLocaleString()}</p>
                </div>
                <div>
                    <p className="text-gray-500">Size (BTC)</p>
                    <p className="text-white font-mono">{trade.size.toFixed(4)} BTC</p>
                </div>
                <div>
                    <p className="text-gray-500">PnL (ROE)</p>
                    <p className={`font-mono font-bold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
                        {pnlValue > 0 ? '+' : ''}{pnlValue.toFixed(2)} USDT ({(pnlPercent * 100).toFixed(2)}%)
                    </p>
                </div>
            </div>
        </div>
    );
}
