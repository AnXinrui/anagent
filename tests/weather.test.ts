import { afterEach, beforeEach, expect, mock, spyOn, test } from "bun:test";

const schedule = mock((_expression: string, _callback: () => Promise<void>) => undefined);
const getAccessToken = mock(async () => "test-token");
const getSubscribers = mock(async () => ["first", "second"]);
const sendC2CMessage = mock(async (_options: Record<string, string>) => undefined);
mock.module("node-cron", () => ({ default: { schedule } }));
mock.module("../src/qq/api", () => ({ getAccessToken, sendC2CMessage }));
mock.module("../src/storage/subscribers", () => ({ getSubscribers }));
const { getWeather } = await import("../src/weather/getWeather");
const { startWeatherSchedule } = await import("../src/weather/schedule");

beforeEach(() => {
  schedule.mockClear();
  getAccessToken.mockClear();
  getSubscribers.mockClear();
  sendC2CMessage.mockReset();
  sendC2CMessage.mockImplementation(async () => undefined);
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(console, "error").mockImplementation(() => {});
  spyOn(globalThis, "fetch").mockResolvedValue(new Response("厦门: 晴天\n"));
});

afterEach(() => mock.restore());

test("天气查询保持编码、请求头及原始文本", async () => {
  expect(await getWeather("厦门")).toBe("厦门: 晴天\n");
  expect(fetch).toHaveBeenCalledWith(`https://wttr.in/${encodeURIComponent("厦门")}?format=3`, {
    headers: { "User-Agent": "curl/8.0" },
  });
});

test("天气非成功响应保留错误", async () => {
  spyOn(globalThis, "fetch").mockResolvedValueOnce(new Response("失败", { status: 503 }));
  await expect(getWeather("厦门")).rejects.toThrow("weather request failed: 503");
});

test("每天八点、不指定时区，依次推送所有订阅用户", async () => {
  startWeatherSchedule({ appId: "test-app", clientSecret: "test-secret", city: "厦门" });
  expect(schedule.mock.calls[0]).toHaveLength(2);
  expect(schedule.mock.calls[0]?.[0]).toBe("0 8 * * *");
  await schedule.mock.calls[0]![1]();
  expect(getAccessToken).toHaveBeenCalledWith("test-app", "test-secret");
  expect(sendC2CMessage.mock.calls).toEqual([
    [{ accessToken: "test-token", openId: "first", content: "厦门: 晴天\n" }],
    [{ accessToken: "test-token", openId: "second", content: "厦门: 晴天\n" }],
  ]);
});

test("前一条消息发送完成后才发送下一条", async () => {
  const firstStarted = Promise.withResolvers<void>();
  const firstCompleted = Promise.withResolvers<void>();
  sendC2CMessage.mockImplementationOnce(async () => {
    firstStarted.resolve();
    await firstCompleted.promise;
  });
  startWeatherSchedule({ appId: "test-app", clientSecret: "test-secret", city: "厦门" });
  const pushing = schedule.mock.calls[0]![1]();
  await firstStarted.promise;
  expect(sendC2CMessage).toHaveBeenCalledTimes(1);
  firstCompleted.resolve();
  await pushing;
  expect(sendC2CMessage).toHaveBeenCalledTimes(2);
});

test("准备阶段任一失败不推送，记录日志但不向调度器抛错", async () => {
  getSubscribers.mockRejectedValueOnce(new Error("订阅读取失败"));
  startWeatherSchedule({ appId: "test-app", clientSecret: "test-secret", city: "厦门" });
  await schedule.mock.calls[0]![1]();
  expect(sendC2CMessage).not.toHaveBeenCalled();
  expect(console.error).toHaveBeenCalledTimes(1);
});

test("发送抛错后停止后续用户并记录错误", async () => {
  sendC2CMessage.mockRejectedValueOnce(new Error("网络失败"));
  startWeatherSchedule({ appId: "test-app", clientSecret: "test-secret", city: "厦门" });
  await schedule.mock.calls[0]![1]();
  expect(sendC2CMessage).toHaveBeenCalledTimes(1);
  expect(console.error).toHaveBeenCalledTimes(1);
});
