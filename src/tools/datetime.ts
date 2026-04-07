import { registerTool } from "./registry.js";

registerTool({
  name: "get_current_datetime",
  description: "获取当前日期和时间",
  parameters: {
    type: "object",
    properties: {},
    required: [],
  },
  execute: async () => {
    return new Date().toLocaleString("zh-CN", { timeZone: "Asia/Shanghai" });
  },
});
