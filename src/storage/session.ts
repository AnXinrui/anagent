import { access, appendFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

const SESSIONS_DIRECTORY = path.join(process.cwd(), "sessions");

/** 确保会话目录存在。 */
async function ensureSessionsDirectory(): Promise<void> {
  try {
    await access(SESSIONS_DIRECTORY);
  } catch {
    // 目录不可访问时沿用原有的递归创建流程，创建失败继续向外抛出。
    await mkdir(SESSIONS_DIRECTORY, { recursive: true });
  }
}

/** 返回用户会话文件路径。 */
function getSessionFilePath(userId: string): string {
  return path.join(SESSIONS_DIRECTORY, `${userId}.jsonl`);
}

/** 加载用户历史；文件缺失或读取失败时返回空数组，损坏的 JSON 行单独跳过。 */
export async function loadSession(userId: string): Promise<ChatCompletionMessageParam[]> {
  const filePath = getSessionFilePath(userId);
  const messages: ChatCompletionMessageParam[] = [];

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n").filter((line) => line.trim());

    for (const line of lines) {
      try {
        messages.push(JSON.parse(line) as ChatCompletionMessageParam);
      } catch {
        // 跳过损坏行，保留其余可读取的历史消息；只截取行首，避免整行刷屏。
        console.error(`解析 JSON 失败，已跳过该行: ${line.slice(0, 120)}`);
      }
    }
    return messages;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    console.error(`加载会话失败: ${userId}`, error);
    return [];
  }
}

/** 以 JSONL 格式追加新消息，不覆盖已有历史。 */
export async function appendSession(
  userId: string,
  messages: ChatCompletionMessageParam[],
): Promise<void> {
  await ensureSessionsDirectory();
  const filePath = getSessionFilePath(userId);
  const lines = messages.map((message) => `${JSON.stringify(message)}\n`).join("");
  await appendFile(filePath, lines, "utf-8");
}
