import { afterEach, expect, mock, spyOn, test } from "bun:test";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { listOpenAITools } from "../src/tools/registry";

const history: ChatCompletionMessageParam[] = [
  { role: "user", content: "历史问题" },
  { role: "assistant", content: "历史回复" },
];
const client = {};
const loadSession = mock(async (_userId: string) => [...history]);
const appendSession = mock(async (_userId: string, _messages: ChatCompletionMessageParam[]) => undefined);
const toolModel = "gpt-5-mini";
const runLoop = mock(async (_client: unknown, _messages: ChatCompletionMessageParam[], _model?: string) => "模型回复");
mock.module("../src/agent/client", () => ({ client }));
mock.module("../src/agent/loop", () => ({ runLoop, TOOL_MODEL: toolModel }));
mock.module("../src/storage/session", () => ({ loadSession, appendSession }));

afterEach(() => {
  mock.restore();
  loadSession.mockClear();
  appendSession.mockClear();
  runLoop.mockClear();
});

test.each(["default", "custom-user"])("CLI 对话和保存顺序保持一致：%s", async (userId) => {
  const originalArgs = process.argv;
  delete process.env.MODEL;
  process.argv = [process.execPath, "src/main.ts", "你好"];
  if (userId !== "default") {
    process.argv.push(userId);
  }
  const completed = Promise.withResolvers<void>();
  const log = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).startsWith("📊")) {
      completed.resolve();
    }
  });

  try {
    // 独立模块 URL 让入口按不同命令行参数重新执行，依赖仍使用同一组替身。
    await import(`../src/main.ts?case=${userId}`);
    await completed.promise;
    expect(loadSession).toHaveBeenCalledWith(userId);
    expect(runLoop).toHaveBeenCalledWith(client, [...history, { role: "user", content: "你好" }], toolModel);
    expect(appendSession).toHaveBeenCalledWith(userId, [
      { role: "user", content: "你好" },
      { role: "assistant", content: "模型回复" },
    ]);
    expect(log.mock.calls).toEqual([
      [`📚 加载用户 ${userId} 的会话历史...`],
      ["📖 已加载 2 条历史消息"],
      ["模型回复"],
      ["📊 会话统计: 总共 4 条消息\n"],
    ]);
    expect(log.mock.invocationCallOrder[2]!).toBeLessThan(appendSession.mock.invocationCallOrder[0]!);
    expect(listOpenAITools().map((tool) => tool.function.name)).toEqual([
      "get_current_datetime",
      "readFileContent",
      "writeFile",
      "runCommand",
      "Skill",
    ]);
  } finally {
    process.argv = originalArgs;
  }
});

test("CLI 使用 MODEL 环境变量覆盖工具循环模型", async () => {
  const caseId = "model-override";
  const originalArgs = process.argv;
  const originalModel = process.env.MODEL;
  process.env.MODEL = "cli-custom-model";
  process.argv = [process.execPath, "src/main.ts", "你好"];
  const completed = Promise.withResolvers<void>();
  const log = spyOn(console, "log").mockImplementation((...args: unknown[]) => {
    if (String(args[0]).startsWith("📊")) {
      completed.resolve();
    }
  });

  try {
    // 独立模块 URL 让入口读取覆盖后的 MODEL 重新执行，依赖仍使用同一组替身。
    await import(`../src/main.ts?case=${caseId}`);
    await completed.promise;
    expect(runLoop).toHaveBeenCalledWith(client, [...history, { role: "user", content: "你好" }], "cli-custom-model");
  } finally {
    process.argv = originalArgs;
    if (originalModel === undefined) {
      delete process.env.MODEL;
    } else {
      process.env.MODEL = originalModel;
    }
  }
});

/** 不加载真实环境文件，在独立进程验证入口的快速失败分支。 */
async function runEntry(entry: string, includeApiKey = true) {
  const subprocess = Bun.spawn([process.execPath, "--no-env-file", entry], {
    cwd: process.cwd(),
    env: {
      PATH: process.env.PATH ?? "",
      BASE_URL: "http://127.0.0.1:1/v1",
      ...(includeApiKey ? { API_KEY: "test-api-key" } : {}),
    },
    stdout: "pipe",
    stderr: "pipe",
    timeout: 3000,
  });
  const [exitCode, stdout, stderr] = await Promise.all([
    subprocess.exited,
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
  ]);
  return { exitCode, stdout, stderr };
}

test("CLI 无参数仍提示用法并退出 1", async () => {
  const result = await runEntry("src/main.ts");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("请提供消息内容\n使用方法: bun src/main.ts \"你的消息\"\n");
  expect(result.stdout).toBe("");
});

test("QQ 缺少配置不启动连接或调度", async () => {
  const result = await runEntry("src/qq/main.ts");
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toBe("请在 .env 配置 QQ_APP_ID 和 QQ_CLIENT_SECRET\n");
  expect(result.stdout).toBe("");
});

test("缺少 API key 时仍在模块加载阶段失败", async () => {
  const result = await runEntry("src/main.ts", false);
  expect(result.exitCode).toBe(1);
  expect(result.stderr).toContain("apiKey");
  expect(result.stderr).not.toContain("请提供消息内容");
});
