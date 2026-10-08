import type { Tool } from "./Tool";

/** 获取上海时区当前日期时间的工具，由入口显式注册。 */
export const currentDateTimeTool: Tool = {
  name: "get_current_datetime",
  description: "获取当前日期和时间",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  /** 返回中文格式的当前日期时间。 */
  async execute(): Promise<string> {
    return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  },
};
