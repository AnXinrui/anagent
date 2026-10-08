import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import path from "node:path";

// 所有文件操作仅作用于内存，禁止测试触碰真实会话和订阅。
const files = new Map<string, string>();
const readFile = mock(async (filePath: string) => {
  const content = files.get(filePath);
  if (content === undefined) {
    throw Object.assign(new Error("文件不存在"), { code: "ENOENT" });
  }
  return content;
});
const writeFile = mock(async (filePath: string, content: string) => { files.set(filePath, content); });
const appendFile = mock(async (filePath: string, content: string) => {
  files.set(filePath, (files.get(filePath) ?? "") + content);
});
const mkdir = mock(async () => undefined);
const access = mock(async () => undefined);
const fileSystem = { readFile, writeFile, appendFile, mkdir, access };
mock.module("node:fs/promises", () => ({ ...fileSystem, default: fileSystem }));

const workingDirectory = "/isolated-working-directory";
const currentDirectory = spyOn(process, "cwd").mockReturnValue(workingDirectory);
const { loadSession, appendSession } = await import("../src/storage/session");
const { subscribe, unsubscribe, getSubscribers } = await import("../src/storage/subscribers");
currentDirectory.mockRestore();
const sessionPath = path.join(workingDirectory, "sessions", "test-user.jsonl");
const subscribersPath = path.resolve(import.meta.dir, "../data/subscribers.json");

beforeEach(() => {
  files.clear();
  readFile.mockClear();
  writeFile.mockClear();
  appendFile.mockClear();
  mkdir.mockClear();
  spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => mock.restore());

test("会话保留工作目录路径、追加 JSONL 且隔离用户", async () => {
  const first = { role: "user" as const, content: "你好" };
  const second = { role: "assistant" as const, content: "回复" };
  await appendSession("test-user", [first]);
  await appendSession("test-user", [second]);
  expect(files.get(sessionPath)).toBe(`${JSON.stringify(first)}\n${JSON.stringify(second)}\n`);
  expect(await loadSession("test-user")).toEqual([first, second]);
  expect(await loadSession("another-user")).toEqual([]);
});

test("不存在的会话返回空数组，坏行跳过而非丢失其余历史", async () => {
  expect(await loadSession("test-user")).toEqual([]);
  files.set(sessionPath, '\n{"role":"user","content":"保留"}\ninvalid-json\n   \n');
  expect(await loadSession("test-user")).toEqual([{ role: "user", content: "保留" }]);
  expect(console.error).toHaveBeenCalledTimes(1);
});

test("会话读取错误记录后返回空数组，写入错误向外抛出", async () => {
  readFile.mockRejectedValueOnce(Object.assign(new Error("无权限"), { code: "EACCES" }));
  expect(await loadSession("test-user")).toEqual([]);
  expect(console.error).toHaveBeenCalledTimes(1);
  appendFile.mockRejectedValueOnce(new Error("磁盘写满"));
  await expect(appendSession("test-user", [])).rejects.toThrow("磁盘写满");
});

test("会话目录不可访问时递归创建，创建失败继续抛错", async () => {
  access.mockRejectedValueOnce(new Error("目录不存在"));
  await appendSession("test-user", []);
  expect(mkdir).toHaveBeenCalledWith(path.join(workingDirectory, "sessions"), { recursive: true });
  access.mockRejectedValueOnce(new Error("目录不存在"));
  mkdir.mockRejectedValueOnce(new Error("无权创建"));
  await expect(appendSession("test-user", [])).rejects.toThrow("无权创建");
});

test("订阅以项目根路径存储，同名不重复写入", async () => {
  expect(await getSubscribers()).toEqual([]);
  await subscribe("first");
  await subscribe("first");
  await subscribe("second");
  expect(files.get(subscribersPath)).toBe('["first","second"]');
  expect(writeFile).toHaveBeenCalledTimes(2);
  await unsubscribe("first");
  expect(await getSubscribers()).toEqual(["second"]);
  await unsubscribe("missing");
  expect(writeFile).toHaveBeenCalledTimes(4);
});

test("订阅数组过滤非字符串，非数组为空列表，返回独立数组", async () => {
  files.set(subscribersPath, '["valid",1,null,false]');
  const subscribers = await getSubscribers();
  expect(subscribers).toEqual(["valid"]);
  subscribers.push("local-only");
  expect(await getSubscribers()).toEqual(["valid"]);
  files.set(subscribersPath, '{}');
  expect(await getSubscribers()).toEqual([]);
});

test("订阅文件缺失为空列表，但坏 JSON 和读取失败必须抛错", async () => {
  expect(await getSubscribers()).toEqual([]);
  files.set(subscribersPath, "invalid-json");
  await expect(getSubscribers()).rejects.toBeInstanceOf(SyntaxError);
  readFile.mockRejectedValueOnce(new Error("读取失败"));
  await expect(getSubscribers()).rejects.toThrow("读取失败");
});
