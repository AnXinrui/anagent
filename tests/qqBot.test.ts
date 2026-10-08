import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";
import { EventEmitter } from "node:events";

/** 不建立网络连接的 Gateway 替身。 */
class FakeWebSocket extends EventEmitter {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = FakeWebSocket.OPEN;
  send = mock((_data: string) => undefined);

  /** 保存连接实例，供测试触发协议事件。 */
  constructor(public url: string) {
    super();
    FakeWebSocket.instances.push(this);
  }

  /** 等待异步事件处理器完成。 */
  async dispatch(event: string, ...args: unknown[]): Promise<void> {
    for (const listener of this.listeners(event)) {
      await listener(...args);
    }
  }

  /** 注入一条 JSON 消息。 */
  async receive(payload: unknown): Promise<void> {
    await this.dispatch("message", Buffer.from(JSON.stringify(payload)));
  }
}

const getAccessToken = mock(async () => "test-token");
const getGatewayUrl = mock(async () => "wss://gateway.invalid");
const sendC2CMessage = mock(async (_options: Record<string, unknown>) => undefined);
mock.module("ws", () => ({ default: FakeWebSocket }));
mock.module("../src/qq/api", () => ({ getAccessToken, getGatewayUrl, sendC2CMessage }));
const { startQQBot } = await import("../src/qq/bot");

beforeEach(() => {
  FakeWebSocket.instances = [];
  getAccessToken.mockReset();
  getAccessToken.mockResolvedValue("test-token");
  sendC2CMessage.mockReset();
  sendC2CMessage.mockResolvedValue(undefined);
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(console, "error").mockImplementation(() => {});
  spyOn(globalThis, "setInterval").mockReturnValue(123 as unknown as ReturnType<typeof setInterval>);
  spyOn(globalThis, "clearInterval").mockImplementation(() => {});
  spyOn(globalThis, "setTimeout").mockReturnValue(456 as unknown as ReturnType<typeof setTimeout>);
});

afterEach(() => mock.restore());

test("Hello 鉴权、默认心跳、序号及关闭重连保持一致", async () => {
  await startQQBot({ appId: "test-app", clientSecret: "test-secret", onMessage: async () => {} });
  const socket = FakeWebSocket.instances[0]!;
  expect(socket.url).toBe("wss://gateway.invalid");
  await socket.receive({ op: 10 });
  expect(JSON.parse(socket.send.mock.calls[0]![0])).toEqual({
    op: 2, d: { token: "QQBot test-token", intents: 1 << 25, shard: [0, 1] },
  });
  const interval = spyOn(globalThis, "setInterval");
  expect(interval.mock.calls[0]?.[1]).toBe(30000);
  await socket.receive({ op: 0, s: 42, t: "IGNORED" });
  const heartbeat = interval.mock.calls[0]![0] as () => void;
  heartbeat();
  expect(JSON.parse(socket.send.mock.calls[1]![0])).toEqual({ op: 1, d: 42 });
  socket.readyState = 3;
  heartbeat();
  expect(socket.send).toHaveBeenCalledTimes(2);
  await socket.dispatch("close", 1000, Buffer.from("关闭"));
  expect(clearInterval).toHaveBeenCalledWith(123);
  expect(spyOn(globalThis, "setTimeout").mock.calls[0]?.[1]).toBe(5000);
});

test("自定义心跳替换上一个计时器", async () => {
  await startQQBot({ appId: "test-app", clientSecret: "test-secret", onMessage: async () => {} });
  const socket = FakeWebSocket.instances[0]!;
  await socket.receive({ op: 10, d: { heartbeat_interval: 12000 } });
  await socket.receive({ op: 10, d: { heartbeat_interval: 15000 } });
  expect(clearInterval).toHaveBeenCalledWith(123);
  expect(spyOn(globalThis, "setInterval").mock.calls.map((call) => call[1])).toEqual([12000, 15000]);
});

test("私聊内容修剪并关联回复，忽略空消息与其他事件", async () => {
  const onMessage = mock(async (message: { reply: (content: string) => Promise<void> }) => {
    await message.reply("回复");
  });
  await startQQBot({ appId: "test-app", clientSecret: "test-secret", onMessage });
  const socket = FakeWebSocket.instances[0]!;
  const event = { id: "message-1", author: { user_openid: "user" }, content: "  你好  " };
  await socket.receive({ op: 0, t: "OTHER", d: event });
  await socket.receive({ op: 0, t: "C2C_MESSAGE_CREATE", d: { ...event, content: "  " } });
  await socket.receive({ op: 0, t: "C2C_MESSAGE_CREATE", d: {} });
  await socket.receive({ op: 0, t: "C2C_MESSAGE_CREATE", d: event });
  expect(onMessage).toHaveBeenCalledTimes(1);
  expect(onMessage.mock.calls[0]?.[0]).toMatchObject({ userOpenId: "user", text: "你好", messageId: "message-1" });
  expect(sendC2CMessage).toHaveBeenCalledWith({
    accessToken: "test-token", openId: "user", content: "回复", replyToMessageId: "message-1",
  });
});

test("业务处理失败回复原兜底文本，兜底发送失败不继续抛错", async () => {
  await startQQBot({
    appId: "test-app", clientSecret: "test-secret",
    onMessage: async () => { throw new Error("业务失败"); },
  });
  sendC2CMessage.mockRejectedValueOnce(new Error("发送失败"));
  await FakeWebSocket.instances[0]!.receive({
    op: 0, t: "C2C_MESSAGE_CREATE",
    d: { id: "message-1", author: { user_openid: "user" }, content: "你好" },
  });
  expect(sendC2CMessage.mock.calls[0]?.[0].content).toBe("处理消息时发生错误，请稍后再试");
});

test("连接初始化失败仍安排五秒后重试", async () => {
  getAccessToken.mockRejectedValueOnce(new Error("认证失败"));
  await startQQBot({ appId: "test-app", clientSecret: "test-secret", onMessage: async () => {} });
  expect(FakeWebSocket.instances).toHaveLength(0);
  expect(spyOn(globalThis, "setTimeout").mock.calls[0]?.[1]).toBe(5000);
  expect(console.error).toHaveBeenCalledTimes(1);
});
