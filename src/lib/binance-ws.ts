import WebSocket from 'ws';

export type PriceUpdateCallback = (price: number) => void;

interface BinanceTickerData {
    e: string;      // Event type
    E: number;      // Event time
    s: string;      // Symbol
    c: string;      // Close price
    o: string;      // Open price
    h: string;      // High price
    l: string;      // Low price
    v: string;      // Total traded base asset volume
    q: string;      // Total traded quote asset volume
}

/**
 * Real-time WebSocket connection to Binance Futures for BTC price monitoring
 * Eliminates the need for REST API polling and ensures no price spikes are missed
 */
export class BinancePriceWebSocket {
    private ws: WebSocket | null = null;
    private wsUrl = 'wss://fstream.binance.com/ws/btcusdt@ticker';
    private callbacks: PriceUpdateCallback[] = [];
    private reconnectInterval = 5000; // 5 seconds
    private pingInterval: NodeJS.Timeout | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private isIntentionalClose = false;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 10;

    /**
     * Register a callback to be invoked on every price update
     */
    public onPriceUpdate(callback: PriceUpdateCallback): void {
        this.callbacks.push(callback);
    }

    /**
     * Establish WebSocket connection to Binance Futures
     */
    public connect(): void {
        try {
            console.log('🔌 Connecting to Binance Futures WebSocket...');
            this.ws = new WebSocket(this.wsUrl);

            this.ws.on('open', () => {
                console.log('✅ WebSocket connected to Binance Futures (BTCUSDT Ticker)');
                this.reconnectAttempts = 0;
                this.startPingInterval();
            });

            this.ws.on('message', (data: WebSocket.Data) => {
                try {
                    const ticker: BinanceTickerData = JSON.parse(data.toString());
                    const price = parseFloat(ticker.c);

                    // Invoke all registered callbacks with the latest price
                    this.callbacks.forEach(cb => cb(price));
                } catch (error) {
                    console.error('Error parsing WebSocket message:', error);
                }
            });

            this.ws.on('error', (error) => {
                console.error('❌ WebSocket error:', error.message);
            });

            this.ws.on('close', () => {
                console.log('🔌 WebSocket connection closed');
                this.stopPingInterval();

                // Auto-reconnect unless intentionally closed
                if (!this.isIntentionalClose) {
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectAttempts++;
                        console.log(`🔄 Reconnecting in ${this.reconnectInterval / 1000}s... (Attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
                        this.reconnectTimeout = setTimeout(() => this.connect(), this.reconnectInterval);
                    } else {
                        console.error('❌ Max reconnection attempts reached. Please restart the service.');
                    }
                }
            });

            this.ws.on('ping', () => {
                this.ws?.pong();
            });

        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
        }
    }

    /**
     * Gracefully close the WebSocket connection
     */
    public disconnect(): void {
        this.isIntentionalClose = true;
        this.stopPingInterval();
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
        }
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        console.log('🔌 WebSocket disconnected intentionally');
    }

    /**
     * Start heartbeat ping to keep connection alive
     * Binance recommends sending ping every 3 minutes
     */
    private startPingInterval(): void {
        this.pingInterval = setInterval(() => {
            if (this.ws && this.ws.readyState === WebSocket.OPEN) {
                this.ws.ping();
                // console.log('🏓 Ping sent to Binance WebSocket');
            }
        }, 3 * 60 * 1000); // 3 minutes
    }

    /**
     * Stop heartbeat ping interval
     */
    private stopPingInterval(): void {
        if (this.pingInterval) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }
    }

    /**
     * Get current WebSocket connection state
     */
    public isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}
