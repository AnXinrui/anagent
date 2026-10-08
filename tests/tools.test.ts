import { afterEach, expect, mock, setSystemTime, test } from "bun:test";
import { getTool, listOpenAITools, registerTool } from "../src/tools/registry";
import { currentDateTimeTool } from "../src/tools/getCurrentDateTime";
import { toOpenAITool } from "../src/tools/Tool";

registerTool(currentDateTimeTool);

afterEach(() => {
  setSystemTime();
  mock.restore();
});

test("日期工具保持协议名、参数和上海中文时间", async () => {
  setSystemTime(new Date("2026-10-08T00:00:00Z"));
  const tool = getTool("get_current_datetime")!;
  expect(tool.parameters).toEqual({ type: "object", properties: {}, required: [] });
  expect(await tool.execute({})).toBe(new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" }));
});

test("注册表同名覆盖但不改变顺序，未知工具返回 undefined", () => {
  const tool = { name: "example", description: "示例", parameters: {}, execute: async () => "结果" };
  registerTool(tool);
  registerTool({ ...tool, description: "覆盖" });
  expect(listOpenAITools().map((entry) => entry.function.name)).toEqual(["get_current_datetime", "example"]);
  expect(getTool("example")?.description).toBe("覆盖");
  expect(getTool("missing")).toBeUndefined();
});

test("协议转换只暴露模型需要的字段", () => {
  expect(toOpenAITool(currentDateTimeTool)).toEqual({
    type: "function",
    function: {
      name: "get_current_datetime",
      description: "获取当前日期和时间",
      parameters: { type: "object", properties: {}, required: [] },
    },
  });
});
