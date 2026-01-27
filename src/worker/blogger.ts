
import './init';
import { supabaseAdmin } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

export async function runBlogger() {
    console.log('--- Starting Daily Blogger ---', new Date().toISOString());

    try {
        // 1. Fetch Last 24h Data
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const { data: logs } = await supabaseAdmin
            .from('logs')
            .select('*')
            .gt('created_at', oneDayAgo)
            .order('created_at', { ascending: true }); // Chronological

        const { data: trades } = await supabaseAdmin
            .from('trades')
            .select('*')
            .gt('created_at', oneDayAgo);

        if (!logs || logs.length === 0) {
            console.log("No logs to summarize. Skipping.");
            return;
        }

        // 2. Prepare Context for AI
        const tradeSummary = trades?.map(t =>
            `- ${t.side} ${t.symbol} (Leverage: ${t.leverage}x): Entry $${t.entry_price}, ${t.status === 'CLOSED' ? `Closed at ${new Date(t.closed_at).toLocaleTimeString()} (PnL: ${t.pnl})` : 'Still OPEN'}`
        ).join('\n') || "No trades executed today.";

        // Pick interesting logs. Limit to 50 relevant ones.
        const relevantLogs = logs.filter(l => l.type === 'INFO' && l.ai_response).slice(0, 50);
        const logContext = relevantLogs.map(l => {
            try {
                const ai = JSON.parse(l.ai_response || '{}');
                return `[${new Date(l.created_at).getHours()}:00] Action: ${ai.action} (Conf: ${ai.confidence}%) - Reason: ${ai.reason}`;
            } catch { return ''; }
        }).join('\n');

        const prompt = `
            Act as a professional Crypto Fund Manager writing a daily trading journal "Alpha Log".
            
            Using the data below, write a blog post summarizing the last 24 hours of Bitcoin market activity and our bot's performance.
            
            ### TRADES EXECUTED
            ${tradeSummary}

            ### AI DECISION LOGS (Sampled)
            ${logContext}

            ### WRITING GUIDELINES
            - Title: Catchy and relevant to the market movement (e.g., "Bitcoin Consolidates while AI Hunts for Shorts").
            - Tone: Professional, analytical, yet engaging.
            - Structure:
              1. **Market Recap**: What happened to price/trend today? (Derive from logs).
              2. **Strategy Review**: How did our "Fractal Momentum Surge" strategy perform? Did we stay out? Why? (Quote specific reasons like "low volatility" or "conflicting signals").
              3. **Performance**: Brief PnL summary.
              4. **Outlook**: What are we watching next?

            Output format: JSON 
            { 
              "title_en": "...", 
              "content_en": "Markdown...",
              "title_ko": "...",
              "content_ko": "Markdown (Korean translation)..."
            } 
            Ensure content fields are valid Markdown strings.
        `;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { responseMimeType: 'application/json' } });
        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        let json: any;
        try {
            json = JSON.parse(responseText);
        } catch (e) {
            console.log("JSON parse error, attempting regex extraction...");
            const match = responseText.match(/```json\n([\s\S]*?)\n```/);
            if (match) json = JSON.parse(match[1]);
            else throw e;
        }

        if (Array.isArray(json)) {
            json = json[0];
        }

        const { title_en, content_en, title_ko, content_ko } = json || {};

        if (!title_en || !content_en) {
            console.error("Missing title or content in response:", json);
            return;
        }

        console.log(`Generated Post Title (EN): ${title_en}`);
        console.log(`Generated Post Content Length: ${content_en?.length}`);

        // 3. Save to DB
        // Note: DB columns must exist (title_ko, content_ko). If not, this might fail or ignore them depending on Supabase config.
        const { data: insertedData, error } = await supabaseAdmin.from('posts').insert({
            title: title_en,
            content: content_en,
            title_ko: title_ko || title_en,   // Fallback
            content_ko: content_ko || content_en // Fallback
        }).select();

        if (error) {
            console.error("❌ Post Insert Error Full:", JSON.stringify(error, null, 2));
        } else {
            console.log("✅ Blog Post Published Successfully!", insertedData);
        }

    } catch (e) {
        console.error("Blogger Error:", e);
    }
}
