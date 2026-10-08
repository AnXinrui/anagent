import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { client } from "../agent/client";
import { runLoop } from "../agent/loop";
import { buildSkillsPrompt, listSkills } from "../skills/listSkills";
import { parseUserPrompt } from "../skills/parseUserPrompt";
import { appendSession, loadSession } from "../storage/session";
import { subscribe, unsubscribe } from "../storage/subscribers";
import type { QQMessage } from "./bot";

const MAX_HISTORY_MESSAGES = 40;
const SYSTEM_PROMPT =
  "你是一个聪明、友善的 AI 助手，名字叫 AnAgent。你会用中文简洁地回答用户的问题，不废话，不重复用户说的内容。";

/** 处理订阅指令和普通私聊（含 /技能名 指令展开），普通回复在持久化成功后发送。 */
export async function handleMessage(message: QQMessage): Promise<void> {
  const { userOpenId, text, reply } = message;
  if (text === "订阅") {
    await subscribe(userOpenId);
    await reply("✅ 已订阅，每天早 8 点推送天气");
    return;
  }
  if (text === "取消订阅") {
    await unsubscribe(userOpenId);
    await reply("❌ 已取消订阅");
    return;
  }

  const skills = listSkills();
  const skillsPrompt = buildSkillsPrompt(skills);
  const systemContent = skillsPrompt ? `${SYSTEM_PROMPT}\n\n${skillsPrompt}` : SYSTEM_PROMPT;

  const history = await loadSession(userOpenId);
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: systemContent },
    ...history.slice(-MAX_HISTORY_MESSAGES),
    { role: "user", content: parseUserPrompt(text, skills) },
  ];
  const assistantText = await runLoop(client, messages);
  await appendSession(userOpenId, [
    { role: "user", content: text },
    { role: "assistant", content: assistantText },
  ]);
  await reply(assistantText);
}
