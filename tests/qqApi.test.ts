import { afterEach, beforeEach, expect, mock, setSystemTime, spyOn, test } from "bun:test";
import { getAccessToken, getGatewayUrl, sendC2CMessage } from "../src/qq/api";

let now = Date.UTC(2026, 0, 1);
beforeEach(() => {
  now += 24 * 60 * 60 * 1000;
  setSystemTime(now);
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(console, "error").mockImplementation(() => {});
  spyOn(globalThis, "fetch").mockResolvedValue(Response.json({}));
});

afterEach(() => {
  setSystemTime();
  mock.restore();
});

test("token 请求参数、默认有效期和提前 60 秒刷新保持一致", async () => {
  const request = spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ access_token: "first" }));
  expect(await getAccessToken("test-app", "test-secret")).toBe("first");
  expect(request).toHaveBeenCalledWith("https://bots.qq.com/app/getAppAccessToken", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ appId: "test-app", clientSecret: "test-secret" }),
  });
  setSystemTime(now + (7200 - 61) * 1000);
  expect(await getAccessToken("test-app", "test-secret")).toBe("first");
  expect(request).toHaveBeenCalledTimes(1);
  setSystemTime(now + (7200 - 60) * 1000);
  request.mockResolvedValueOnce(Response.json({ access_token: "second", expires_in: "120" }));
  expect(await getAccessToken("test-app", "test-secret")).toBe("second");
  expect(request).toHaveBeenCalledTimes(2);
});

test("token 缺失或 HTTP 失败必须抛错", async () => {
  await expect(getAccessToken("test-app", "test-secret")).rejects.toThrow("拿 token 失败");
  spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ access_token: "invalid" }, { status: 401 }));
  await expect(getAccessToken("test-app", "test-secret")).rejects.toThrow("拿 token 失败");
});

test("gateway 地址和认证头保持一致，缺失地址时抛错", async () => {
  spyOn(globalThis, "fetch").mockResolvedValueOnce(Response.json({ url: "wss://gateway.invalid" }));
  expect(await getGatewayUrl("test-token")).toBe("wss://gateway.invalid");
  expect(fetch).toHaveBeenCalledWith("https://api.sgroup.qq.com/gateway", {
    headers: { Authorization: "QQBot test-token" },
  });
  await expect(getGatewayUrl("test-token")).rejects.toThrow("拿 gateway 失败");
});

test("消息序号递增，只有回复包含 msg_id，HTTP 失败仅记录日志", async () => {
  const request = spyOn(globalThis, "fetch");
  await sendC2CMessage({ accessToken: "test-token", openId: "user", content: "主动推送" });
  request.mockResolvedValueOnce(new Response("失败", { status: 500 }));
  await sendC2CMessage({ accessToken: "test-token", openId: "user", content: "回复", replyToMessageId: "message-1" });
  const firstRequest = request.mock.calls[0]!;
  expect(firstRequest[0]).toBe("https://api.sgroup.qq.com/v2/users/user/messages");
  expect(firstRequest[1]?.headers).toEqual({ Authorization: "QQBot test-token", "Content-Type": "application/json" });
  expect(JSON.parse(firstRequest[1]?.body as string)).toEqual({ content: "主动推送", msg_type: 0, msg_seq: 1 });
  expect(JSON.parse(request.mock.calls[1]![1]?.body as string)).toEqual({
    content: "回复", msg_type: 0, msg_seq: 2, msg_id: "message-1",
  });
  expect(console.error).toHaveBeenCalledWith("[qq-api] 发送消息失败:", 500, "失败");
});
