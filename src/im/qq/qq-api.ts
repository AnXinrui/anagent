const TOKEN_URL = "https://bots.qq.com/app/getAppAccessToken";
const API_BASE = "https://api.sgroup.qq.com";

let tokenCache: { token: string; expiresAt: number } | null = null;
let msgSeqCounter = 1;

export async function getAccessToken(appId: string, secret: string): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.token;
  }

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId, clientSecret: secret }),
  });
  const data = (await res.json()) as { access_token?: string; expires_in?: number };

  if (!res.ok || !data.access_token) {
    throw new Error(`拿 token 失败: ${JSON.stringify(data)}`);
  }

  const expiresIn = Number(data.expires_in ?? 7200);
  tokenCache = { token: data.access_token, expiresAt: Date.now() + expiresIn * 1000 };
  console.log("[qq-api] access_token 获取成功，有效期", expiresIn, "秒");
  return tokenCache.token;
}

export async function getGatewayUrl(accessToken: string): Promise<string> {
  const res = await fetch(`${API_BASE}/gateway`, {
    headers: { Authorization: `QQBot ${accessToken}` },
  });
  const data = (await res.json()) as { url?: string };

  if (!res.ok || !data.url) {
    throw new Error(`拿 gateway 失败: ${JSON.stringify(data)}`);
  }

  console.log("[qq-api] gateway 地址:", data.url);
  return data.url;
}

export async function sendC2CMessage(params: {
  accessToken: string;
  openid: string;
  content: string;
  replyToMessageId?: string;
}): Promise<void> {
  const { accessToken, openid, content, replyToMessageId } = params;
  const msgSeq = msgSeqCounter++;

  const res = await fetch(`${API_BASE}/v2/users/${openid}/messages`, {
    method: "POST",
    headers: {
      Authorization: `QQBot ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      content,
      msg_type: 0,
      msg_seq: msgSeq,
      ...(replyToMessageId ? { msg_id: replyToMessageId } : {}),
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error("[qq-api] 发送消息失败:", res.status, body);
  } else {
    console.log("[qq-api] 消息已发送到", openid);
  }
}
