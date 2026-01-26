'use client';

import { useEffect, useRef, memo } from 'react';

function TradingViewChart() {
  const containerCallback = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerCallback.current) return;

    // Check if script already exists to prevent duplicates
    if (containerCallback.current.querySelector('script')) return;

    const script = document.createElement('script');
    script.src = 'https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js';
    script.type = 'text/javascript';
    script.async = true;
    script.innerHTML = `
      {
        "width": "100%",
        "height": "100%",
        "symbol": "BINANCE:BTCUSDT.P",
        "interval": "5",
        "timezone": "Etc/UTC",
        "theme": "dark",
        "style": "1",
        "locale": "en",
        "enable_publishing": false,
        "backgroundColor": "rgba(0, 0, 0, 1)",
        "gridColor": "rgba(66, 66, 66, 0.06)",
        "hide_top_toolbar": false,
        "hide_legend": false,
        "save_image": false,
        "calendar": false,
        "hide_volume": false,
        "support_host": "https://www.tradingview.com"
      }`;

    containerCallback.current.appendChild(script);
  }, []);

  return (
    <div className="w-full h-[500px] bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden shadow-lg" id="tradingview-widget-container">
      <div className="tradingview-widget-container__widget h-full w-full" ref={containerCallback}></div>
    </div>
  );
}

export default memo(TradingViewChart);
