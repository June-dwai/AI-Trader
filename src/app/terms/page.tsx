import Link from 'next/link';

export default function TermsPage() {
    return (
        <main className="min-h-screen bg-black text-gray-300 p-8 md:p-12">
            <div className="max-w-4xl mx-auto space-y-12">

                {/* Header */}
                <div className="border-b border-gray-800 pb-6">
                    <h1 className="text-3xl font-bold text-white mb-2">Terms of Service & Risk Disclosure</h1>
                    <p className="text-gray-500 text-sm">Last Updated: January 2026</p>
                </div>

                {/* Section 1: Non-Advisory Disclaimer */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-red-500 flex items-center gap-2">
                        ⚠️ IMPORTANT: NOT FINANCIAL ADVICE
                    </h2>
                    <div className="bg-red-900/10 border border-red-900/30 p-6 rounded-xl text-sm leading-relaxed text-gray-300">
                        <p className="font-bold mb-2">
                            Using &quot;AI Bitcoin Trader&quot; (hereinafter referred to as &quot;The Service&quot;) means you agree to the following absolute disclaimers:
                        </p>
                        <ul className="list-disc pl-5 space-y-2">
                            <li>
                                <strong>Software Tool, Not an Advisor:</strong> The Service is purely an algorithmic analysis tool coupled with an automated execution script. It generates signals based on mathematical indicators and historical data. It does NOT constitute financial, investment, legal, or tax advice.
                            </li>
                            <li>
                                <strong>No Guarantee of Profit:</strong> Cryptocurrency trading involves extreme risk. Past performance of the AI model does NOT guarantee future results. You acknowledge that you can lose 100% of your funds.
                            </li>
                            <li>
                                <strong>User Responsibility:</strong> All trading decisions made using this data are solely your responsibility. The Service and its developers are NOT liable for any financial losses, liquidation damages, or platform errors.
                            </li>
                        </ul>
                    </div>
                </section>

                {/* Section 2: US User Restriction */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white">🚫 Geographic Restrictions (No US Users)</h2>
                    <p className="text-sm leading-relaxed">
                        The Service is <strong>NOT intended for citizens or residents of the United States of America</strong>.
                        By accessing this website, you confirm that you are not a US Person.
                        We do not offer services regarding US-regulated futures or derivatives.
                        If you are a US resident, you must leave this site immediately.
                    </p>
                </section>

                {/* Section 3: High Risk Warning */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white">💀 High Risk Warning</h2>
                    <p className="text-sm leading-relaxed">
                        Trading cryptocurrencies on margin (Futures/Leverage) carries a high level of risk and may not be suitable for all investors.
                        The high degree of leverage can work against you as well as for you.
                        Before deciding to trade, you should carefuly consider your investment objectives, level of experience, and risk appetite.
                    </p>
                </section>

                {/* Section 4: Limitation of Liability */}
                <section className="space-y-4">
                    <h2 className="text-xl font-bold text-white">⚖️ Limitation of Liability</h2>
                    <p className="text-sm leading-relaxed">
                        To the maximum extent permitted by applicable law, the developers of The Service shall not be liable for any indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly, or any loss of data, use, goodwill, or other intangible losses, resulting from (a) your access to or use of or inability to access or use the service; (b) any conduct or content of any third party on the service.
                    </p>
                </section>

                <div className="pt-8 border-t border-gray-800 text-center">
                    <Link href="/" className="px-6 py-2 bg-gray-800 text-white rounded-full hover:bg-gray-700 transition-colors text-sm font-bold">
                        I Understand & Return to Dashboard
                    </Link>
                </div>

            </div>
        </main>
    );
}
