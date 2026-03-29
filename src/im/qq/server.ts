import "dotenv/config";
import { chat, type Message } from "../../llm.js";
import { loadSession, saveSession } from "../../session.js";
import { startQQBot } from "./qq-bot.js";

async function main() {
  const APP_ID = process.env.QQ_APP_ID;
  const CLIENT_SECRET = process.env.QQ_CLIENT_SECRET;

  if (!APP_ID || !CLIENT_SECRET) {
    console.error("请在 .env 配置 QQ_APP_ID 和 QQ_CLIENT_SECRET");
    process.exit(1);
  }

  console.log("[qq] 启动中，AppID:", APP_ID);

  await startQQBot({
    appId: APP_ID,
    clientSecret: CLIENT_SECRET,
    onMessage: async ({ userOpenid, text, reply }) => {
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
