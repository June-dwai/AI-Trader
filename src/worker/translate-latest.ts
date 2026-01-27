
import './init';
import { supabaseAdmin } from '../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

async function translateLatestPost() {
    console.log("--- TRANSLATING LATEST POST ---");

    try {
        // 1. Fetch Latest Post
        const { data: posts, error: fetchError } = await supabaseAdmin
            .from('posts')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (fetchError || !posts || posts.length === 0) {
            console.error("❌ Failed to fetch latest post:", fetchError);
            return;
        }

        const post = posts[0];
        console.log(`Found Post: "${post.title}" (ID: ${post.id})`);

        if (post.title_ko && post.content_ko) {
            console.log("⚠️ This post already has Korean content. Skipping.");
            return;
        }

        // 2. Ask Gemini to Translate
        const prompt = `
            Translate the following blog post content into professional Korean (Financial/Crypto tone).
            
            Title: ${post.title}
            Content:
            ${post.content}

            Output format: JSON { "title_ko": "...", "content_ko": "..." }
        `;

        const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash', generationConfig: { responseMimeType: 'application/json' } });
        const result = await model.generateContent(prompt);
        const { title_ko, content_ko } = JSON.parse(result.response.text());

        console.log(`Translated Title: ${title_ko}`);

        // 3. Update DB
        const { error: updateError } = await supabaseAdmin
            .from('posts')
            .update({
                title_ko,
                content_ko
            })
            .eq('id', post.id);

        if (updateError) {
            console.error("❌ Update failed:", updateError);
        } else {
            console.log("✅ Post updated with Korean translation!");
        }

    } catch (e) {
        console.error("Error:", e);
    }
}

translateLatestPost();
