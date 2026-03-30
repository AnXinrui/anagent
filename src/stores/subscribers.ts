/**
 * 订阅用户列表的持久化：读写项目根目录下 data/subscribers.json（JSON 数组字符串）。
 */

import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';

/** 订阅列表文件的绝对路径（本文件在 src/stores，向上两级到项目根再进 data） */
const SUBSCRIBERS_FILE = path.join(__dirname, '..', '..', 'data', 'subscribers.json');

/**
 * 从磁盘读取当前订阅 openid 列表；文件不存在或内容非法时视为空列表。
 */
async function readList(): Promise<string[]> {
  try {
    /* 按 UTF-8 读成字符串，再 JSON.parse 成 JS 值 */
    const raw = await readFile(SUBSCRIBERS_FILE, 'utf-8');
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }
    /* 只保留元素为 string 的项，避免文件被改坏后把非字符串写回去 */
    return parsed.filter((item): item is string => typeof item === 'string');
  } catch (err) {
    const e = err as NodeJS.ErrnoException;
    /* ENOENT：文件或目录不存在，第一次用时正常 */
    if (e.code === 'ENOENT') {
      return [];
    }
    throw err;
  }
}

/**
 * 把整个列表覆盖写入 subscribers.json；必要时创建 data 目录。
 */
async function writeList(list: string[]): Promise<void> {
  await mkdir(path.dirname(SUBSCRIBERS_FILE), { recursive: true });
  await writeFile(SUBSCRIBERS_FILE, JSON.stringify(list), 'utf-8');
}

/**
 * 订阅：若 openid 尚不在列表中则追加并保存。
 *
 * @param openid 用户 openid
 */
export async function subscribe(openid: string): Promise<void> {
  const list = await readList();
  if (list.includes(openid)) {
    return;
  }
  list.push(openid);
  await writeList(list);
}

/** 取消订阅：从列表中去掉该 openid 并保存（没有则相当于写回原列表）。 */
export async function unsubscribe(openid: string): Promise<void> {
  const list = await readList();
  await writeList(list.filter((id) => id !== openid));
}

/** 返回当前所有订阅 openid（只读视图：每次都是新数组，调用方改数组不会影响磁盘）。 */
export async function getSubscribers(): Promise<string[]> {
  return readList();
}
