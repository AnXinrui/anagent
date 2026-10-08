import { afterAll, afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import type { MessageHandler } from "../src/qq/bot";
import type { Skill } from "../src/skills/listSkills";
import { getTool } from "../src/tools/registry";

const loadSession = mock(async (_userId: string): Promise<ChatCompletionMessageParam[]> => []);
const appendSession = mock(async (_userId: string, _messages: ChatCompletionMessageParam[]) => undefined);
const subscribe = mock(async (_openId: string) => undefined);
const unsubscribe = mock(async (_openId: string) => undefined);
const runLoop = mock(async (_client: unknown, _messages: ChatCompletionMessageParam[]) => "模型回复");
const startWeatherSchedule = mock((_options: Record<string, string>) => undefined);
const startQQBot = mock(async (_options: { onMessage: MessageHandler }) => undefined);
const listSkills = mock((): Skill[] => []);
const buildSkillsPrompt = mock((_skills: Skill[]): string | null => null);
mock.module("../src/storage/session", () => ({ loadSession, appendSession }));
mock.module("../src/storage/subscribers", () => ({ subscribe, unsubscribe }));
mock.module("../src/skills/listSkills", () => ({ listSkills, buildSkillsPrompt }));
const client = {};
mock.module("../src/agent/client", () => ({ client }));
mock.module("../src/agent/loop", () => ({ runLoop }));
mock.module("../src/weather/schedule", () => ({ startWeatherSchedule }));
mock.module("../src/qq/bot", () => ({ startQQBot }));

const originalAppId = process.env.QQ_APP_ID;
const originalSecret = process.env.QQ_CLIENT_SECRET;
process.env.QQ_APP_ID = "test-app";
process.env.QQ_CLIENT_SECRET = "test-secret";
spyOn(console, "log").mockImplementation(() => {});
await import("../src/qq/main");
const handleMessage = startQQBot.mock.calls[0]![0].onMessage;
const reply = mock(async (_content: string) => undefined);

beforeEach(() => {
  loadSession.mockReset();
  loadSession.mockResolvedValue([]);
  appendSession.mockClear();
  subscribe.mockClear();
  unsubscribe.mockClear();
  runLoop.mockClear();
  reply.mockClear();
  listSkills.mockClear();
  listSkills.mockReturnValue([]);
  buildSkillsPrompt.mockClear();
  buildSkillsPrompt.mockReturnValue(null);
});
afterEach(() => mock.restore());
afterAll(() => {
  if (originalAppId === undefined) {
    delete process.env.QQ_APP_ID;
  } else {
    process.env.QQ_APP_ID = originalAppId;
  }
  if (originalSecret === undefined) {
    delete process.env.QQ_CLIENT_SECRET;
  } else {
    process.env.QQ_CLIENT_SECRET = originalSecret;
  }
});

/** 使用捕获到的真实业务处理器发送测试消息。 */
async function sendMessage(text: string): Promise<void> {
  await handleMessage({ userOpenId: "user", text, messageId: "message-1", reply });
}

test("入口使用环境配置并启动厦门天气调度", () => {
  expect(startQQBot).toHaveBeenCalledTimes(1);
  expect(getTool("get_current_datetime")).toBeDefined();
  expect(getTool("readFileContent")).toBeDefined();
  expect(getTool("writeFile")).toBeDefined();
  expect(getTool("runCommand")).toBeDefined();
  expect(getTool("Skill")).toBeDefined();
  expect(startQQBot.mock.calls[0]?.[0]).toMatchObject({ appId: "test-app", clientSecret: "test-secret" });
  expect(startWeatherSchedule).toHaveBeenCalledWith({ appId: "test-app", clientSecret: "test-secret", city: "厦门" });
});

test("订阅和取消订阅直接回复，不触发模型或会话操作", async () => {
  await sendMessage("订阅");
  expect(subscribe).toHaveBeenCalledWith("user");
  expect(reply).toHaveBeenCalledWith("✅ 已订阅，每天早 8 点推送天气");
  await sendMessage("取消订阅");
  expect(unsubscribe).toHaveBeenCalledWith("user");
  expect(reply).toHaveBeenCalledWith("❌ 已取消订阅");
  expect(runLoop).not.toHaveBeenCalled();
  expect(loadSession).not.toHaveBeenCalled();
  expect(appendSession).not.toHaveBeenCalled();
});

test("普通消息保留系统提示词、最后 40 条历史，先保存再回复", async () => {
  const history: ChatCompletionMessageParam[] = Array.from({ length: 44 }, (_, index) => ({
    role: "user", content: String(index),
  }));
  loadSession.mockResolvedValueOnce(history);
  await sendMessage("查询");
  expect(runLoop).toHaveBeenCalledWith(client, [
    {
      role: "system",
      content: "你是一个聪明、友善的 AI 助手，名字叫 AnAgent。你会用中文简洁地回答用户的问题，不废话，不重复用户说的内容。",
    },
    ...history.slice(-40),
    { role: "user", content: "查询" },
  ]);
  expect(appendSession).toHaveBeenCalledWith("user", [
    { role: "user", content: "查询" }, { role: "assistant", content: "模型回复" },
  ]);
  expect(appendSession.mock.invocationCallOrder[0]!).toBeLessThan(reply.mock.invocationCallOrder[0]!);
});

test("存在技能时系统提示词追加技能清单", async () => {
  listSkills.mockReturnValue([{ name: "apple", description: "苹果", context: "", body: "" }]);
  buildSkillsPrompt.mockReturnValue("技能清单文本");
  await sendMessage("查询");
  expect(runLoop).toHaveBeenCalledWith(client, [
    {
      role: "system",
      content: "你是一个聪明、友善的 AI 助手，名字叫 AnAgent。你会用中文简洁地回答用户的问题，不废话，不重复用户说的内容。\n\n技能清单文本",
    },
    { role: "user", content: "查询" },
  ]);
});

test("斜杠技能指令展开后发给模型，会话保存原文", async () => {
  listSkills.mockReturnValue([{ name: "greet", description: "打招呼", context: "", body: "你好 $ARGUMENTS" }]);
  await sendMessage("/greet 世界");
  expect(runLoop).toHaveBeenCalledWith(client, [
    {
      role: "system",
      content: "你是一个聪明、友善的 AI 助手，名字叫 AnAgent。你会用中文简洁地回答用户的问题，不废话，不重复用户说的内容。",
    },
    { role: "user", content: "你好 世界" },
  ]);
  expect(appendSession).toHaveBeenCalledWith("user", [
    { role: "user", content: "/greet 世界" }, { role: "assistant", content: "模型回复" },
  ]);
});

test("保存失败不回复，错误交回机器人兜底", async () => {
  appendSession.mockRejectedValueOnce(new Error("保存失败"));
  await expect(sendMessage("查询")).rejects.toThrow("保存失败");
  expect(reply).not.toHaveBeenCalled();
});
