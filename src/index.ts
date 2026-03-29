import { chat, type Message } from "./llm";
import { loadSession, saveSession } from './session.js';

async function main() {
  const userMessage = process.argv[2];
  if (!userMessage) {
    console.error("请提供消息内容");
    console.error('使用方法: npx tsx src/index.ts "你的消息"');
    process.exit(1);
  }
  const userId = process.argv[3] || 'default';
  try {
    console.log(`📚 加载用户 ${userId} 的会话历史...`);
    const history = await loadSession(userId);
    console.log(`📖 已加载 ${history.length} 条历史消息`);

    const chatMessages: Message[] = [
      ...history,
      { role: 'user', content: userMessage },
    ];

    const reply = await chat(chatMessages, (piece) => process.stdout.write(piece));

    const newMessages: Message[] = [
      { role: 'user', content: userMessage },
      { role: 'assistant', content: reply },
    ];

    await saveSession(userId, newMessages);
    const totalMessages = history.length + 2;
    console.log(`📊 会话统计: 总共 ${totalMessages} 条消息\n`);
  } catch {
    console.error("调用 AI 失败");
    process.exit(1);
  }
}

main();
