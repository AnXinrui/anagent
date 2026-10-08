import { afterEach, expect, mock, spyOn, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { readFileTool } from "../src/tools/readFile";
import { runCommandTool } from "../src/tools/runCommand";
import { writeFileTool } from "../src/tools/writeFile";

const tempDirs: string[] = [];

/** 创建本次用例独占的临时目录，结束后统一清理。 */
async function createTempDir(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "anagent-tools-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(async () => {
  mock.restore();
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("readFileContent 读取 UTF-8 内容，文件不存在时抛出中文错误", async () => {
  spyOn(console, "log").mockImplementation(() => {});
  const dir = await createTempDir();
  const filePath = path.join(dir, "note.txt");
  await writeFileTool.execute({ filePath, content: "你好，世界" });
  expect(await readFileTool.execute({ filePath })).toBe("你好，世界");

  const missingPath = path.join(dir, "missing.txt");
  await expect(readFileTool.execute({ filePath: missingPath })).rejects.toThrow(
    `文件不存在: ${missingPath}`,
  );
});

test("writeFile 自动创建多级目录并覆盖写入", async () => {
  spyOn(console, "log").mockImplementation(() => {});
  const dir = await createTempDir();
  const filePath = path.join(dir, "a", "b", "note.txt");
  expect(await writeFileTool.execute({ filePath, content: "第一版" })).toBe(
    `文件已写入: ${filePath}`,
  );
  await writeFileTool.execute({ filePath, content: "第二版" });
  expect(await readFile(filePath, "utf-8")).toBe("第二版");
});

test("runCommand 返回去除空白的标准输出，失败时抛出原错误", async () => {
  spyOn(console, "error").mockImplementation(() => {});
  expect(await runCommandTool.execute({ command: "echo hello" })).toBe("hello");
  await expect(runCommandTool.execute({ command: "exit 3" })).rejects.toThrow();
});
