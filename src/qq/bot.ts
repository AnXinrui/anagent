import WebSocket from "ws";
import { getAccessToken, getGatewayUrl, sendC2CMessage } from "./api";

const DEFAULT_HEARTBEAT_INTERVAL_MS = 30_000;
const RECONNECT_DELAY_MS = 5000;
const C2C_MESSAGE_INTENT = 1 << 25;
const GATEWAY_OP = {
  DISPATCH: 0,
  HEARTBEAT: 1,
  IDENTIFY: 2,
  HELLO: 10,
} as const;

/** 传递给业务处理器的 QQ 私聊消息。 */
export interface QQMessage {
  /** 发送用户的 OpenID。 */
  userOpenId: string;
  /** 去除首尾空白后的消息正文。 */
  text: string;
  /** 原始消息 ID。 */
  messageId: string;
  /** 回复当前消息。 */
  reply(content: string): Promise<void>;
}

/** 私聊消息的异步业务处理器。 */
export type MessageHandler = (message: QQMessage) => Promise<void>;

/** QQ Gateway 连接配置。 */
interface QQBotOptions {
  /** QQ 应用标识。 */
  appId: string;
  /** QQ 应用密钥。 */
  clientSecret: string;
  /** 私聊消息处理器。 */
  onMessage: MessageHandler;
}

/** QQ Gateway 消息信封，字段名遵循远端协议。 */
interface GatewayPayload {
  /** 操作码。 */
  op: number;
  /** 事件数据。 */
  d?: unknown;
  /** 消息序号。 */
  s?: number;
  /** 事件类型。 */
  t?: string;
}

/** QQ 私聊事件的原始数据。 */
interface C2CMessageEvent {
  /** 消息标识。 */
  id: string;
  /** 原始消息内容。 */
  content: string;
  /** 发送方信息，保留 QQ 协议字段。 */
  author: { user_openid: string };
}

/** 连接 QQ Gateway，维护心跳和重连，并分发私聊消息。 */
export async function startQQBot(options: QQBotOptions): Promise<void> {
  const { appId, clientSecret, onMessage } = options;
  let heartbeatTimer: NodeJS.Timeout | null = null;
  let lastSequence: number | null = null;

  /** 建立连接并注册本次连接的事件处理器。 */
  async function connect(): Promise<void> {
    console.log("[qq-bot] 正在连接 QQ Gateway...");
    try {
      const accessToken = await getAccessToken(appId, clientSecret);
      const gatewayUrl = await getGatewayUrl(accessToken);
      const socket = new WebSocket(gatewayUrl);

      socket.on("open", () => {
        console.log("[qq-bot] WebSocket 已建立连接");
      });

      socket.on("message", async (raw) => {
        const payload = JSON.parse(raw.toString()) as GatewayPayload;
        if (typeof payload.s === "number") {
          lastSequence = payload.s;
        }

        if (payload.op === GATEWAY_OP.HELLO) {
          const heartbeatInterval =
            (payload.d as { heartbeat_interval?: number })?.heartbeat_interval ??
            DEFAULT_HEARTBEAT_INTERVAL_MS;

          socket.send(
            JSON.stringify({
              op: GATEWAY_OP.IDENTIFY,
              d: {
                token: `QQBot ${accessToken}`,
                intents: C2C_MESSAGE_INTENT,
                shard: [0, 1],
              },
            }),
          );

          if (heartbeatTimer) {
            clearInterval(heartbeatTimer);
          }
          heartbeatTimer = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({ op: GATEWAY_OP.HEARTBEAT, d: lastSequence }));
            }
          }, heartbeatInterval);

          console.log(`[qq-bot] 鉴权完成，心跳间隔 ${heartbeatInterval}ms，等待消息中...`);
          return;
        }

        if (payload.op !== GATEWAY_OP.DISPATCH || payload.t !== "C2C_MESSAGE_CREATE") {
          return;
        }

        const event = payload.d as C2CMessageEvent | undefined;
        if (!event?.author?.user_openid || typeof event.content !== "string") {
          return;
        }

        const userOpenId = event.author.user_openid;
        const text = event.content.trim();
        const messageId = event.id;
        if (!text) {
          return;
        }

        console.log(`[qq-bot] 收到私信 [${userOpenId}]: ${text}`);
        const currentToken = await getAccessToken(appId, clientSecret);
        const reply = async (content: string): Promise<void> => {
          await sendC2CMessage({
            accessToken: currentToken,
            openId: userOpenId,
            content,
            replyToMessageId: messageId,
          });
        };

        try {
          await onMessage({ userOpenId, text, messageId, reply });
        } catch (error) {
          console.error("[qq-bot] onMessage 处理出错:", error);
          await reply("处理消息时发生错误，请稍后再试").catch((replyError) => {
            console.error("[qq-bot] 错误提示发送失败:", replyError);
          });
        }
      });

      socket.on("close", (code, reason) => {
        if (heartbeatTimer) {
          clearInterval(heartbeatTimer);
          heartbeatTimer = null;
        }
        console.log(`[qq-bot] 连接断开 code=${code} reason=${reason.toString()}，5 秒后重连`);
        setTimeout(() => void connect(), RECONNECT_DELAY_MS);
      });

      socket.on("error", (error) => {
        console.error("[qq-bot] WebSocket 错误:", error.message);
      });
    } catch (error) {
      console.error("[qq-bot] 连接失败:", error);
      console.log("[qq-bot] 5 秒后重试...");
      setTimeout(() => void connect(), RECONNECT_DELAY_MS);
    }
  }

  await connect();
}
