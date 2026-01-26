'use client';

import { useEffect, useState } from 'react';
import { getBitcoinPrice } from '@/lib/binance';
import { DollarSign } from 'lucide-react';

interface Trade {
    id: number;
    symbol: string;
    side: 'LONG' | 'SHORT';
    entry_price: number;
    leverage: number;
    size: number;
    opened_at: string;
}

interface WalletCardProps {
    initialBalance: number;
    initialPnL: number; // Realized PnL from closed trades (for stats)
    activeTrade: Trade | null;
}

export default function WalletCard({ initialBalance, initialPnL, activeTrade }: WalletCardProps) {
    const [currentPrice, setCurrentPrice] = useState<number | null>(null);

    // Derived State (No need for useEffect)
    let unrealizedPnL = 0;
    let equity = initialBalance;

    if (activeTrade && currentPrice) {
        const isLong = activeTrade.side === 'LONG';
        // Correct PnL Formula: (Price Diff) * Size * Direction
        const pnlValue = (currentPrice - activeTrade.entry_price) * activeTrade.size * (isLong ? 1 : -1);
        unrealizedPnL = pnlValue;
        equity = initialBalance + pnlValue;
    }

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const p = await getBitcoinPrice();
                setCurrentPrice(p);
            } catch (e) {
                console.error(e);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 5000); // Sync with ActivePosition
        return () => clearInterval(interval);
    }, []);

    return (
        <div className="bg-gradient-to-br from-gray-900 to-gray-900 border border-gray-800 p-6 rounded-2xl relative overflow-hidden group hover:border-blue-500/50 transition-colors">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                <DollarSign className="w-24 h-24 text-blue-500" />
            </div>

            <p className="text-gray-400 text-sm font-medium">Total Equity</p>

            <div className="flex items-baseline gap-2 mt-2">
                <p className={`text-4xl font-bold transition-colors duration-500 ${unrealizedPnL !== 0 ? 'text-white' : 'text-white'}`}>
                    ${equity.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
                {/* Realized PnL Badge */}
                <div className="text-xs text-gray-400 bg-gray-800/50 px-2 py-1 rounded-full">
                    Balance: ${initialBalance.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </div>
                <div className={`text-xs px-2 py-1 rounded-full ${initialPnL >= 0 ? 'text-green-500 bg-green-900/10' : 'text-red-500 bg-red-900/10'}`}>
                    Realized: {initialPnL >= 0 ? '+' : ''}{initialPnL.toFixed(2)}
                </div>

                {/* Unrealized PnL Badge (Live) */}
                {activeTrade && (
                    <div className={`flex items-center gap-1 text-xs font-bold px-2 py-1 rounded-full ${unrealizedPnL >= 0 ? 'bg-green-900/20 text-green-400' : 'bg-red-900/20 text-red-400'} transition-all duration-500`}>
                        {unrealizedPnL > 0 ? '+' : ''}{unrealizedPnL.toFixed(2)} Live PnL
                    </div>
                )}
            </div>
        </div>
    );
}
