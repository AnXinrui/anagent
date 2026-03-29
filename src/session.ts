import fs from 'fs/promises';
import path from 'path';
import { type Message } from './llm.js';

// 会话文件存储目录
const SESSIONS_DIR = path.join(process.cwd(), 'sessions');

/**
 * 确保 sessions 目录存在
 */
async function ensureSessionsDir() {
  try {
    await fs.access(SESSIONS_DIR);
  } catch {
    // 目录不存在，创建它
    await fs.mkdir(SESSIONS_DIR, { recursive: true });
  }
}

/**
 * 获取会话文件路径
 */
function getSessionFilePath(userId: string): string {
  return path.join(SESSIONS_DIR, `${userId}.jsonl`);
}


/**
 * 加载某个用户的历史消息
 * @param userId 用户ID
 * @returns 历史消息数组，如果文件不存在则返回空数组
 */
export async function loadSession(userId: string): Promise<Message[]> {
  const filePath = getSessionFilePath(userId);
  const messages: Message[] = [];
  try {
    // 读取文件内容
    const content = await fs.readFile(filePath, 'utf-8');
    
    // 按行分割，过滤空行
    const lines = content.split('\n').filter(line => line.trim());
    
    // 解析每一行 JSON
    for (const line of lines) {
      try {
        const message = JSON.parse(line) as Message;
        messages.push(message);
      } catch (parseError) {
        console.error(`解析 JSON 失败: ${line}`, parseError);
        // 跳过格式错误的行，继续处理其他行
      }
    }
    
    return messages;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return []; // 文件不存在是正常情况，静默返回空数组
    }
    console.error(`加载会话失败: ${userId}`, error);
    return [];
  }
  
}

/**
 * 把新的一轮对话追加保存
 * @param userId 用户ID
 * @param messages 要追加的消息数组
 */
export async function saveSession(userId: string, messages: Message[]): Promise<void> {
  // 确保目录存在
  await ensureSessionsDir();
  
  const filePath = getSessionFilePath(userId);
  
  // 将每条消息转换为 JSON 行并追加到文件
  const lines = messages.map(msg => JSON.stringify(msg) + '\n').join('');
  await fs.appendFile(filePath, lines, 'utf-8');
}