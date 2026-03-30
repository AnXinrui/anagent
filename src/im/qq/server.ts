import "dotenv/config";
import { chat, type Message } from "../../llm.js";
import { loadSession, saveSession } from "../../session.js";
import { subscribe, unsubscribe } from "../../stores/subscribers.js";
import { startScheduler } from "../../tasks/scheduler.js";
import { startQQBot } from "./qq-bot.js";

async function main() {
  const APP_ID = process.env.QQ_APP_ID;
  const CLIENT_SECRET = process.env.QQ_CLIENT_SECRET;

  if (!APP_ID || !CLIENT_SECRET) {
    console.error("请在 .env 配置 QQ_APP_ID 和 QQ_CLIENT_SECRET");
    process.exit(1);
  }

  console.log("[qq] 启动中，AppID:", APP_ID);

  startScheduler({ appId: APP_ID, clientSecret: CLIENT_SECRET, city: '厦门' })

  await startQQBot({
    appId: APP_ID,
    clientSecret: CLIENT_SECRET,
    onMessage: async ({ userOpenid, text, reply }) => {
      if (text === '订阅') {
        await subscribe(userOpenid)
        await reply('✅ 已订阅，每天早 8 点推送天气')
        return
      }
      if (text === '取消订阅') {
        await unsubscribe(userOpenid)
        await reply('❌ 已取消订阅')
        return
      }

      const MAX_HISTORY_ROUNDS = 20;
      const history = await loadSession(userOpenid);
      const trimmedHistory = history.slice(-MAX_HISTORY_ROUNDS * 2);
      const chatMessages: Message[] = [
        {
          role: "system",
          content:
            "你是一个聪明、友善的 AI 助手，名字叫 AnAgent。你会用中文简洁地回答用户的问题，不废话，不重复用户说的内容。" ,
        },
        ...trimmedHistory,
        { role: "user", content: text },
      ];
      const assistantText = await chat(chatMessages);
      await saveSession(userOpenid, [
        { role: "user", content: text },
        { role: "assistant", content: assistantText },
      ]);
      await reply(assistantText);
    },
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
