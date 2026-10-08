const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";
const API_BASE_URL = "https://api.sgroup.qq.com";
const TOKEN_REFRESH_MARGIN_MS = 60_000;
const DEFAULT_TOKEN_LIFETIME_SECONDS = 7200;
const TEXT_MESSAGE_TYPE = 0;

let tokenCache: { token: string; expiresAt: number } | null = null;
let nextMessageSequence = 1;

/** QQ 私聊文本消息的发送参数。 */
interface SendMessageOptions {
  /** 当前访问令牌。 */
  accessToken: string;
  /** 接收用户的 OpenID。 */
  openId: string;
  /** 消息正文。 */
  content: string;
  /** 被回复的消息 ID；主动推送不传。 */
  replyToMessageId?: string;
}

/** 获取访问令牌，在过期前一分钟刷新进程内缓存。 */
export async function getAccessToken(appId: string, clientSecret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS) {
    return tokenCache.token;
  }

  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, clientSecret }),
  });
  const data = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!response.ok || !data.access_token) {
    throw new Error(`拿 token 失败: ${JSON.stringify(data)}`);
  }

  const expiresIn = Number(data.expires_in ?? DEFAULT_TOKEN_LIFETIME_SECONDS);
  tokenCache = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  console.log("[qq-api] access_token 获取成功，有效期", expiresIn, "秒");
  return tokenCache.token;
}

/** 获取当前机器人连接的 Gateway 地址。 */
export async function getGatewayUrl(accessToken: string): Promise<string> {
  const response = await fetch(`${API_BASE_URL}/gateway`, {
    headers: { Authorization: `QQBot ${accessToken}` },
  });
  const data = (await response.json()) as { url?: string };
  if (!response.ok || !data.url) {
    throw new Error(`拿 gateway 失败: ${JSON.stringify(data)}`);
  }

  console.log("[qq-api] gateway 地址:", data.url);
  return data.url;
}

/** 发送私聊消息；HTTP 错误仅记录日志，网络异常继续向外抛出。 */
export async function sendC2CMessage(options: SendMessageOptions): Promise<void> {
  const { accessToken, openId, content, replyToMessageId } = options;
  const messageSequence = nextMessageSequence++;

  const response = await fetch(`${API_BASE_URL}/v2/users/${openId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `QQBot ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      msg_type: TEXT_MESSAGE_TYPE,
      msg_seq: messageSequence,
      ...(replyToMessageId ? { msg_id: replyToMessageId } : {}),
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error("[qq-api] 发送消息失败:", response.status, body);
    return;
  }
  console.log("[qq-api] 消息已发送到", openId);
}
