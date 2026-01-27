
import './init';
import axios from 'axios';

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function getTelegramUpdates() {
    console.log("--- FETCHING TELEGRAM UPDATES ---");

    if (!TELEGRAM_BOT_TOKEN) {
        console.error("❌ TELEGRAM_BOT_TOKEN is missing in .env.local");
        return;
    }

    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getUpdates`;

    try {
        console.log(`Checking updates for Bot...`);
        const response = await axios.get(url);
        const updates = response.data.result;

        if (updates.length === 0) {
            console.log("⚠️ No messages found.");
            console.log("👉 Please open your bot in Telegram and send a message (e.g., 'Hello').");
            console.log("   Then run this script again.");
            return;
        }

        console.log(`✅ Found ${updates.length} messages. Here are the latest User/Chat IDs:`);

        updates.slice(-5).forEach((u: any) => {
            const msg = u.message || u.my_chat_member;
            if (msg) {
                const chat = msg.chat;
                const user = msg.from;
                console.log(`------------------------------------------------`);
                console.log(`📅 Date: ${new Date(msg.date * 1000).toLocaleString()}`);
                console.log(`👤 User: ${user.first_name} (${user.username || 'No Username'})`);
                console.log(`💬 Text: ${msg.text || 'System Message'}`);
                console.log(`🔑 CHAT ID: ${chat.id}  <-- USE THIS IN .env.local`);
                console.log(`------------------------------------------------`);
            }
        });

    } catch (error) {
        console.error("❌ Failed to fetch updates:", error);
    }
}

getTelegramUpdates();
