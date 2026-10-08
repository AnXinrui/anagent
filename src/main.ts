import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { chat } from "./agent/chat";
import { client } from "./agent/client";
import { appendSession, loadSession } from "./storage/session";

const DEFAULT_USER_ID = "default";

/** 执行一轮命令行对话，输出回复并追加保存用户会话。 */
async function main(): Promise<void> {
  const userMessage = process.argv[2];
  if (!userMessage) {
    console.error("请提供消息内容");
    console.error("使用方法: bun src/main.ts \"你的消息\"");
    process.exit(1);
  }

  const userId = process.argv[3] || DEFAULT_USER_ID;
  try {
    console.log(`📚 加载用户 ${userId} 的会话历史...`);
    const history = await loadSession(userId);
    console.log(`📖 已加载 ${history.length} 条历史消息`);

    const messages: ChatCompletionMessageParam[] = [
      ...history,
      { role: "user", content: userMessage },
    ];

    const reply = await chat(client, messages);
    const newMessages: ChatCompletionMessageParam[] = [
      { role: "user", content: userMessage },
      { role: "assistant", content: reply.content },
    ];
    console.log(reply.content);

    await appendSession(userId, newMessages);
    const totalMessages = history.length + 2;
    console.log(`📊 会话统计: 总共 ${totalMessages} 条消息\n`);
  } catch {
    console.error("调用 AI 失败");
    process.exit(1);
  }
}

void main();
