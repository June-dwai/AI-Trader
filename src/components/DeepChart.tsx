/* eslint-disable @typescript-eslint/no-explicit-any */
'use client';

import { createChart, ColorType, IChartApi, CandlestickSeries, LineSeries } from 'lightweight-charts';
import { useEffect, useRef, useState } from 'react';

export default function DeepChart() {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!chartContainerRef.current) return;

        // 1. Initialize Chart
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: '#111827' }, // Gray-900
                textColor: '#9CA3AF',
            },
            grid: {
                vertLines: { color: '#1F2937' },
                horzLines: { color: '#1F2937' },
            },
            width: chartContainerRef.current.clientWidth,
            height: chartContainerRef.current.clientHeight, // Use container height
            timeScale: {
                timeVisible: true,
                secondsVisible: false,
                borderColor: '#374151',
            },
            rightPriceScale: {
                borderColor: '#374151',
            },
        });
        chartRef.current = chart;

        // 2. Add Series (v5 API)
        const candleSeries = chart.addSeries(CandlestickSeries, {
            upColor: '#10B981',
            downColor: '#EF4444',
            borderVisible: false,
            wickUpColor: '#10B981',
            wickDownColor: '#EF4444'
        });

        const whiteZoneUpperSeries = chart.addSeries(LineSeries, {
            color: 'white',
            lineWidth: 2,
            lineStyle: 0,
            title: 'WZ Upper',
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        const whiteZoneLowerSeries = chart.addSeries(LineSeries, {
            color: 'white',
            lineWidth: 2,
            lineStyle: 0,
            title: 'WZ Lower',
            crosshairMarkerVisible: false,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        const ema200Series = chart.addSeries(LineSeries, {
            color: '#fbbf24', // Yellow-400
            lineWidth: 2,
            lineStyle: 0,
            title: 'EMA 200',
            crosshairMarkerVisible: true,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        const vwapSeries = chart.addSeries(LineSeries, {
            color: '#3b82f6', // Blue-500
            lineWidth: 2,
            lineStyle: 2, // Dashed
            title: 'VWAP',
            crosshairMarkerVisible: true,
            lastValueVisible: false,
            priceLineVisible: false,
        });

        // 3. Fetch Data
        const fetchData = async () => {
            try {
                const res = await fetch('/api/market/history');
                const data = await res.json();

                if (data && Array.isArray(data)) {
                    // Candle Data
                    const candles = data.map((d: any) => ({
                        time: d.time,
                        open: d.open,
                        high: d.high,
                        low: d.low,
                        close: d.close
                    }));
                    candleSeries.setData(candles);

                    // White Zone Data
                    const wzUpper = data
                        .filter((d: any) => d.whiteZone)
                        .map((d: any) => ({ time: d.time, value: d.whiteZone.upper }));

                    const wzLower = data
                        .filter((d: any) => d.whiteZone)
                        .map((d: any) => ({ time: d.time, value: d.whiteZone.lower }));

                    if (wzUpper.length > 0) whiteZoneUpperSeries.setData(wzUpper);
                    if (wzLower.length > 0) whiteZoneLowerSeries.setData(wzLower);

                    // EMA 200 & VWAP
                    const ema200Data = data
                        .filter((d: any) => d.ema200)
                        .map((d: any) => ({ time: d.time, value: d.ema200 }));

                    const vwapData = data
                        .filter((d: any) => d.vwap)
                        .map((d: any) => ({ time: d.time, value: d.vwap }));

                    if (ema200Data.length > 0) ema200Series.setData(ema200Data);
                    if (vwapData.length > 0) vwapSeries.setData(vwapData);

                    // Fit Content once loaded
                    if (!loading && candles.length > 0) {
                        chart.timeScale().fitContent();
                    }
                }
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
        const interval = setInterval(fetchData, 60000); // Poll every minute

        // 4. Resize Observer
        const resizeObserver = new ResizeObserver((entries) => {
            if (entries.length === 0 || !entries[0].contentRect) return;
            const { width, height } = entries[0].contentRect;
            chart.applyOptions({ width, height });
        });
        resizeObserver.observe(chartContainerRef.current);

        return () => {
            resizeObserver.disconnect();
            clearInterval(interval);
            chart.remove();
        };
    }, []); // eslint-disable-next-line react-hooks/exhaustive-deps

    return (
        <div className="relative w-full h-[500px] bg-gray-900 border border-gray-800 rounded-2xl shadow-lg p-0 flex flex-col">
            <div className="absolute top-4 left-4 z-10 flex flex-wrap gap-2 pointer-events-none">
                <span className="px-2 py-1 bg-black/50 text-xs rounded text-white font-bold backdrop-blur-sm">BTCUSDT 1m</span>
                <span className="px-2 py-1 bg-white/10 text-xs rounded text-white flex items-center gap-1 backdrop-blur-sm border border-white/20">
                    <div className="w-2 h-2 rounded-full bg-white"></div> White Zone
                </span>
                <span className="px-2 py-1 bg-yellow-900/30 text-xs rounded text-yellow-400 flex items-center gap-1 backdrop-blur-sm border border-yellow-500/20">
                    <div className="w-2 h-2 rounded-full bg-yellow-400"></div> EMA 200
                </span>
                <span className="px-2 py-1 bg-blue-900/30 text-xs rounded text-blue-400 flex items-center gap-1 backdrop-blur-sm border border-blue-500/20">
                    <div className="w-2 h-2 rounded-full bg-blue-400"></div> VWAP
                </span>
            </div>
            {loading && <div className="absolute inset-0 flex items-center justify-center text-gray-500 z-20 bg-gray-900/50">Loading Market Data...</div>}

            {/* Chart Container - Flex grow to fill */}
            <div className="flex-1 w-full overflow-hidden rounded-2xl" ref={chartContainerRef} style={{ position: 'relative' }} />
        </div>
    );
}
