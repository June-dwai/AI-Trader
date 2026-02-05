import { supabaseAdmin } from '@/lib/supabase';
import PriceTicker from '@/components/PriceTicker';
import RealtimeLogs from '@/components/RealtimeLogs';
import ActivePosition from '@/components/ActivePosition';
import TradeHistory from '@/components/TradeHistory';
import TradingViewChart from '@/components/TradingViewChart';
import PerformanceChart from '@/components/PerformanceChart';

// Force dynamic rendering since we fetch DB data
export const dynamic = 'force-dynamic';

async function getWallet() {
  const { data } = await supabaseAdmin.from('wallet').select('*').single();
  // Fallback if no wallet
  return data || { balance: 1000 };
}

async function getStats() {
  const { data: trades } = await supabaseAdmin.from('trades').select('*');
  const winCount = trades?.filter(t => t.status === 'CLOSED' && t.pnl && t.pnl > 0).length || 0;
  const totalTrades = trades?.filter(t => t.status === 'CLOSED').length || 0;
  const totalPnL = trades?.reduce((acc, t) => acc + (t.pnl || 0), 0) || 0;

  return { winCount, totalTrades, totalPnL };
}

async function getPerformanceStats() {
  const { data: history } = await supabaseAdmin
    .from('wallet_history')
    .select('*')
    .order('timestamp', { ascending: true });

  if (!history || history.length === 0) {
    return { alpha: 0, avgDailyPnl: 0 };
  }

  // Calculate alpha vs BTC
  const initialBalance = 1000;
  const currentBalance = history[history.length - 1].balance;
  const usdtReturn = ((currentBalance - initialBalance) / initialBalance) * 100;

  const initialBtc = history[0].btc_price;
  const currentBtc = history[history.length - 1].btc_price;
  const btcReturn = ((currentBtc - initialBtc) / initialBtc) * 100;

  const alpha = usdtReturn - btcReturn;

  // Calculate average daily PnL
  const dailyPnls = history
    .map(h => h.daily_pnl)
    .filter(p => p !== null) as number[];

  const avgDailyPnl = dailyPnls.length > 0
    ? dailyPnls.reduce((a, b) => a + b, 0) / dailyPnls.length
    : 0;

  return { alpha, avgDailyPnl };
}

async function getActiveTrade() {
  const { data } = await supabaseAdmin.from('trades').select('*').eq('status', 'OPEN').single();
  return data; // Returns null if no active trade
}

export default async function Home() {
  const wallet = await getWallet();
  const stats = await getStats();
  const performanceStats = await getPerformanceStats();
  const activeTrade = await getActiveTrade();

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-gray-800 pb-6">
          <div className="flex items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                AI Bitcoin Trader
              </h1>
              <p className="text-gray-400 text-sm mt-1">Autonomous Gemini Agent</p>
            </div>
            <a href="/blog" className="ml-4 px-3 py-1 bg-blue-900/20 text-blue-400 text-xs font-bold rounded-full border border-blue-500/30 hover:bg-blue-900/40 transition-colors">
              Read Blog
            </a>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl px-6 py-3 flex items-center gap-4 shadow-lg shadow-purple-900/10">
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Current Price</p>
              <PriceTicker />
            </div>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 1. 현재 잔고 */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <div className="flex items-center gap-2">
              <p className="text-gray-400 text-sm font-medium">현재 잔고</p>
              <span className={`text-sm font-medium ${(wallet.balance - 1000) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                ({(wallet.balance - 1000) >= 0 ? '+' : ''}{Math.floor(wallet.balance - 1000).toLocaleString()} USDT)
              </span>
            </div>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-bold text-white">
                ${wallet.balance.toLocaleString()}
              </p>
              <p className="text-sm text-gray-500 mb-1">USDT</p>
            </div>
          </div>

          {/* 2. 알파 수익 (vs BTC) */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">알파 수익 (vs BTC)</p>
            <div className="flex items-end gap-2 mt-2">
              <p className={`text-3xl font-bold ${performanceStats.alpha >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {performanceStats.alpha >= 0 ? '+' : ''}{performanceStats.alpha.toFixed(1)}%
              </p>
            </div>
          </div>

          {/* 3. 평균 일수익 */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">평균 일수익</p>
            <div className="flex items-end gap-2 mt-2">
              <p className={`text-3xl font-bold ${performanceStats.avgDailyPnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {performanceStats.avgDailyPnl >= 0 ? '+' : ''}${performanceStats.avgDailyPnl.toFixed(2)}
              </p>
            </div>
          </div>

          {/* 4. 승률 */}
          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">승률</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-3xl font-bold text-white">
                {stats.totalTrades > 0 ? ((stats.winCount / stats.totalTrades) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-gray-500 mb-1">
                ({stats.winCount}/{stats.totalTrades})
              </p>
            </div>
          </div>
        </div>



        {/* ACTIVE POSITION SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-3">
            <ActivePosition trade={activeTrade} />
          </div>
        </div>

        {/* PRICE CHART SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-3">
            <TradingViewChart />
          </div>
        </div>

        {/* PERFORMANCE CHART SECTION */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-3">
            <PerformanceChart />
          </div>
        </div>

        {/* Main Content Area */}
        <div className="grid grid-cols-1 gap-8">
          {/* Logs - Full Width */}
          <div>
            <RealtimeLogs />
          </div>
        </div>

        {/* RECENT TRADES SECTION (Full Width) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-3">
            <TradeHistory />
          </div>
        </div>

      </div>
      <footer className="mt-20 border-t border-gray-900 pt-8 pb-12 text-center">
        <div className="max-w-2xl mx-auto px-4">
          <p className="text-xs text-gray-600 leading-relaxed mb-4">
            <strong>DISCLAIMER:</strong> This application is for educational and informational purposes only. It is not financial advice.
            Cryptocurrency trading involves substantial risk of loss and is not suitable for every investor.
            The developers are not responsible for any financial losses incurred from using this software.
          </p>
          <div className="flex justify-center gap-6 text-xs text-gray-500 font-bold uppercase tracking-wider">
            <a href="/terms" className="hover:text-blue-400 transition-colors">Terms of Service</a>
            <a href="/terms" className="hover:text-blue-400 transition-colors">Risk Disclosure</a>
            <span className="text-gray-700">Not for US Residents</span>
          </div>
        </div>
      </footer>
    </main>
  );
}
