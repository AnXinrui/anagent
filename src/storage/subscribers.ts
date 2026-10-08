import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const SUBSCRIBERS_FILE = path.join(import.meta.dir, "..", "..", "data", "subscribers.json");

/** 读取订阅列表；文件缺失或非数组时返回空列表，解析和其他读取错误向外抛出。 */
async function readSubscribers(): Promise<string[]> {
  try {
    const content = await readFile(SUBSCRIBERS_FILE, "utf-8");
    const subscribers: unknown = JSON.parse(content);
    if (!Array.isArray(subscribers)) {
      return [];
    }

    // 仅保留字符串，避免将手工写入的非法元素传播到消息发送流程。
    return subscribers.filter((openId): openId is string => typeof openId === "string");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return [];
    }
    throw error;
  }
}

/** 覆盖写入订阅列表，必要时创建数据目录。 */
async function writeSubscribers(subscribers: string[]): Promise<void> {
  await mkdir(path.dirname(SUBSCRIBERS_FILE), { recursive: true });
  await writeFile(SUBSCRIBERS_FILE, JSON.stringify(subscribers), "utf-8");
}

/** 添加订阅，已订阅的用户不重复写入。 */
export async function subscribe(openId: string): Promise<void> {
  const subscribers = await readSubscribers();
  if (subscribers.includes(openId)) {
    return;
  }
  subscribers.push(openId);
  await writeSubscribers(subscribers);
}

/** 取消订阅；用户不在列表中时仍写回原列表。 */
export async function unsubscribe(openId: string): Promise<void> {
  const subscribers = await readSubscribers();
  await writeSubscribers(subscribers.filter((subscriber) => subscriber !== openId));
}

/** 从磁盘获取独立的订阅列表，修改返回数组不会改变持久化数据。 */
export async function getSubscribers(): Promise<string[]> {
  return readSubscribers();
}
