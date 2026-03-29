import WebSocket from "ws";
import { getAccessToken, getGatewayUrl, sendC2CMessage } from "./qq-api.js";

export type OnMessageCallback = (params: {
  userOpenid: string;
  text: string;
  messageId: string;
  reply: (content: string) => Promise<void>;
}) => Promise<void>;

type WSPayload = {
  op: number;
  d?: unknown;
  s?: number;
  t?: string;
};

type C2CEvent = {
  id: string;
  content: string;
  author: { user_openid: string };
};

export async function startQQBot(params: {
  appId: string;
  clientSecret: string;
  onMessage: OnMessageCallback;
}): Promise<void> {
  const { appId, clientSecret, onMessage } = params;

  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastSeq: number | null = null;

  const connect = async () => {
    console.log("[qq-bot] 正在连接 QQ Gateway...");
    try {
      const accessToken = await getAccessToken(appId, clientSecret);
      const gatewayUrl = await getGatewayUrl(accessToken);
      const ws = new WebSocket(gatewayUrl);

      ws.on("open", () => {
        console.log("[qq-bot] WebSocket 已建立连接");
      });

      ws.on("message", async (raw) => {
        const payload = JSON.parse(raw.toString()) as WSPayload;

        if (typeof payload.s === "number") {
          lastSeq = payload.s;
        }

        if (payload.op === 10) {
          const interval =
            (payload.d as { heartbeat_interval?: number })?.heartbeat_interval ?? 30000;

          ws.send(
            JSON.stringify({
              op: 2,
              d: {
                token: `QQBot ${accessToken}`,
                intents: 1 << 25,
                shard: [0, 1],
              },
            }),
          );

          if (heartbeatTimer) clearInterval(heartbeatTimer);
          heartbeatTimer = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ op: 1, d: lastSeq }));
            }
          }, interval);

          console.log(`[qq-bot] 鉴权完成，心跳间隔 ${interval}ms，等待消息中...`);
          return;
        }

        if (payload.op !== 0 || payload.t !== "C2C_MESSAGE_CREATE") return;

        const event = payload.d as C2CEvent | undefined;
        if (!event?.author?.user_openid || typeof event.content !== "string") return;

        const userOpenid = event.author.user_openid;
        const text = event.content.trim();
        const messageId = event.id;
        if (!text) return;

        console.log(`[qq-bot] 收到私信 [${userOpenid}]: ${text}`);

        const currentToken = await getAccessToken(appId, clientSecret);
        const reply = async (content: string) => {
          await sendC2CMessage({
            accessToken: currentToken,
            openid: userOpenid,
            content,
            replyToMessageId: messageId,
          });
        };

        try {
          await onMessage({ userOpenid, text, messageId, reply });
        } catch (err) {
          console.error("[qq-bot] onMessage 处理出错:", err);
          await reply("处理消息时发生错误，请稍后再试").catch(() => {});
        }
      });

      ws.on("close", (code, reason) => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        console.log(`[qq-bot] 连接断开 code=${code} reason=${reason.toString()}，5 秒后重连`);
        setTimeout(() => void connect(), 5000);
      });

      ws.on("error", (err) => {
        console.error("[qq-bot] WebSocket 错误:", err.message);
      });
    } catch (err) {
      console.error("[qq-bot] 连接失败:", err);
      console.log("[qq-bot] 5 秒后重试...");
      setTimeout(() => void connect(), 5000);
    }
  };

  await connect();
}
