
'use client';

import { useEffect, useState } from 'react';
import { getBitcoinPrice } from '@/lib/binance';
import { ArrowUp, ArrowDown } from 'lucide-react';

export default function PriceTicker() {
    const [price, setPrice] = useState<number | null>(null);
    const [prevPrice, setPrevPrice] = useState<number | null>(null);

    useEffect(() => {
        const fetchPrice = async () => {
            try {
                const p = await getBitcoinPrice();
                setPrevPrice(prev => price);
                setPrice(p);
            } catch (e) {
                console.error(e);
            }
        };

        fetchPrice();
        const interval = setInterval(fetchPrice, 5000); // 5 seconds polling
        return () => clearInterval(interval);
    }, [price]);

    if (!price) return <div className="animate-pulse h-8 w-32 bg-gray-700 rounded"></div>;

    const isUp = prevPrice ? price >= prevPrice : true;

    return (
        <div className="flex items-center gap-2 text-2xl font-bold font-mono">
            <span className={isUp ? 'text-green-400' : 'text-red-400'}>
                ${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
            {isUp ? <ArrowUp className="w-5 h-5 text-green-400" /> : <ArrowDown className="w-5 h-5 text-red-400" />}
        </div>
    );
}
