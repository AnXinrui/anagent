import type { ChatCompletionFunctionTool } from "openai/resources/chat/completions";

/** 模型可调用的工具及其执行协议。 */
export interface Tool {
  /** 暴露给模型的工具名称。 */
  name: string;
  /** 工具用途说明。 */
  description: string;
  /** 工具参数的 JSON Schema。 */
  parameters: Record<string, unknown>;
  /** 执行工具并返回可供模型读取的文本。 */
  execute(args: Record<string, unknown>): Promise<string>;
}

/** 将内部工具定义转换为 OpenAI 函数工具协议。 */
export function toOpenAITool(tool: Tool): ChatCompletionFunctionTool {
  return {
    type: "function",
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  };
}
