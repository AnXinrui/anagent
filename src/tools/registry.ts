import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";
import { toOpenAITool } from "./Tool";
import type { Tool } from "./Tool";

const tools = new Map<string, Tool>();

/** 注册工具；同名工具覆盖原定义且保留注册顺序。 */
export function registerTool(tool: Tool): void {
  tools.set(tool.name, tool);
}

/** 按注册顺序返回模型可用的函数工具定义。 */
export function listOpenAITools(): ChatCompletionFunctionTool[] {
  return [...tools.values()].map(toOpenAITool);
}

/** 查找工具，未注册时返回 undefined。 */
export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}
