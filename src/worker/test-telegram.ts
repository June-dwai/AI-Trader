
import './init';
import { sendTelegramMessage } from '../lib/telegram';

async function testTelegram() {
    console.log("--- TESTING TELEGRAM CONNECTION ---");
    console.log(`Bot Token Present: ${!!process.env.TELEGRAM_BOT_TOKEN}`);
    console.log(`Chat ID Present: ${!!process.env.TELEGRAM_CHAT_ID}`);
    console.log(`Chat ID Value: ${process.env.TELEGRAM_CHAT_ID}`);

    console.log("Sending test message...");
    const success = await sendTelegramMessage("🔔 Test Message from AI Trader 🔔");

    if (success) {
        console.log("✅ Message sent successfully! check your Telegram.");
    } else {
        console.error("❌ Failed to send message. Please check logs above.");
        console.log("Try sending a message to your bot first (/start) to authorize it.");
    }
}

testTelegram();
