import { supabaseAdmin } from '@/lib/supabase';
import PriceTicker from '@/components/PriceTicker';
import RealtimeLogs from '@/components/RealtimeLogs';
import ActivePosition from '@/components/ActivePosition';
import { PlayCircle, Activity } from 'lucide-react';
import TradeHistory from '@/components/TradeHistory';
import TradingViewChart from '@/components/TradingViewChart';
// import DeepChart from '@/components/DeepChart';
import WalletCard from '@/components/WalletCard';

// Force dynamic rendering since we fetch DB data
export const dynamic = 'force-dynamic';

async function getWallet() {
  const { data } = await supabaseAdmin.from('wallet').select('*').single();
  // Fallback if no wallet
  return data || { balance: 1000 };
}

async function getStats() {
  const { data: trades } = await supabaseAdmin.from('trades').select('*');
  const winCount = trades?.filter(t => t.pnl && t.pnl > 0).length || 0;
  const totalTrades = trades?.length || 0;
  const totalPnL = trades?.reduce((acc, t) => acc + (t.pnl || 0), 0) || 0;

  return { winCount, totalTrades, totalPnL };
}

async function getActiveTrade() {
  const { data } = await supabaseAdmin.from('trades').select('*').eq('status', 'OPEN').single();
  return data; // Returns null if no active trade
}

export default async function Home() {
  const wallet = await getWallet();
  const stats = await getStats();
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Wallet & WinRate Cards */}
          <WalletCard
            initialBalance={wallet.balance || 1000}
            initialPnL={stats.totalPnL}
            activeTrade={activeTrade}
          />

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl">
            <p className="text-gray-400 text-sm font-medium">Win Rate</p>
            <div className="flex items-end gap-2 mt-2">
              <p className="text-4xl font-bold text-white">
                {stats.totalTrades > 0 ? ((stats.winCount / stats.totalTrades) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-sm text-gray-500 mb-1">
                ({stats.winCount}/{stats.totalTrades} Trades)
              </p>
            </div>
          </div>

          <div className="bg-gray-900 border border-gray-800 p-6 rounded-2xl flex flex-col justify-center items-center text-center space-y-3">
            <div className="p-3 bg-blue-500/10 rounded-full text-blue-400">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm text-gray-300">Status: <span className="text-green-400 font-bold">Active</span></p>
              <p className="text-xs text-gray-500 mt-1">Next evaluation in ~5 mins</p>
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

        {/* Main Content Area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Logs */}
          <div className="lg:col-span-2 space-y-8">
            <RealtimeLogs />
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* ... Marketing/Strategy info ... */}
            <div className="bg-gradient-to-tr from-purple-900/20 to-blue-900/20 border border-purple-500/30 p-6 rounded-2xl">
              <h3 className="text-lg font-bold text-white mb-2">Detailed Signals on Telegram</h3>
              <p className="text-gray-400 text-sm mb-4">
                Get real-time notifications for every AI decision, including entry price, stop-loss, and reasoning.
              </p>
              <button className="w-full py-3 bg-white text-black font-bold rounded-lg hover:bg-gray-200 transition-colors flex items-center justify-center gap-2">
                <PlayCircle className="w-4 h-4" />
                Subscribe ($4.99/mo)
              </button>
            </div>

            <div className="p-6 border border-gray-800 rounded-2xl text-xs text-gray-500 leading-relaxed">
              <p className="font-bold text-gray-400 mb-2">Strategy Info (v2.0)</p>
              <ul className="space-y-2 list-disc pl-4">
                <li>Model: Google Gemini 2.0 Flash</li>
                <li>Logic: Microstructure & Fractal</li>
                <li>Leverage: Dynamic (5x - 20x)</li>
                <li>Memory: Anti-Catastrophic Forgetting</li>
                <li>Risk: AI-Adaptive SL/TP</li>
              </ul>
            </div>
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
