import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getTool, listOpenAITools } from "../tools/registry";

const TOOL_MODEL = "gpt-5-mini";
const MAX_TOOL_TURNS = 10;

/** 交替执行模型推理和工具调用；工具报错作为结果回传给模型，返回最终文本且不修改传入的消息数组；模型优先取环境变量 MODEL，未设置或为空时回退 TOOL_MODEL。 */
export async function runLoop(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
): Promise<string> {
  const tools = listOpenAITools();
  const history: ChatCompletionMessageParam[] = [...messages];
  const model = process.env.MODEL?.trim() || TOOL_MODEL;

  for (let turn = 0; turn < MAX_TOOL_TURNS; turn++) {
    const response = await client.chat.completions.create({
      model,
      messages: history,
      tools,
    });
    const choice = response.choices[0];
    if (!choice) {
      throw new Error("No choice returned from OpenAI");
    }

    const message = choice.message;
    if (choice.finish_reason === "tool_calls" && message.tool_calls?.length) {
      history.push(message);

      for (const toolCall of message.tool_calls) {
        if (toolCall.type !== "function") {
          continue;
        }

        const { name, arguments: argumentsJson } = toolCall.function;
        let result: string;
        try {
          const args = JSON.parse(argumentsJson) as Record<string, unknown>;
          console.log(`[tool] 调用 ${name}，参数:`, args);
          const tool = getTool(name);
          result = tool ? await tool.execute(args) : `Tool "${name}" not found`;
        } catch (error) {
          // 参数解析或工具执行失败时把错误文本回传模型，让模型自行纠正。
          result = error instanceof Error ? error.message : String(error);
        }
        console.log("[tool] 结果:", result);

        history.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: result,
        });
      }
      continue;
    }

    return message.content ?? "";
  }

  throw new Error(`Tool call loop exceeded ${MAX_TOOL_TURNS} iterations`);
}
