import OpenAI from "openai";

/** 所有入口共用的 OpenAI 兼容客户端，沿用模块加载时的环境配置。 */
export const client = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
});
