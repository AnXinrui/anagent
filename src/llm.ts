import "dotenv/config";
import { OpenAI } from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { getAllTools, getTool, registerTool } from "./tools/registry";

export type Message = ChatCompletionMessageParam;

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
});

registerTool({
  name: 'get_current_time',
  description: '获取当前时间',
  parameters: { type: 'object', properties: {} },
  execute: async () => new Date().toLocaleString('zh-CN'),
});

export async function chat(
  messages: Message[],
  onChunk?: (chunk: string) => void,
) {
  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages,
      stream: true,
    });
    let fullContent = "";
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullContent += content;
        onChunk?.(content);
      }
    }
    if (!fullContent) {
      throw new Error("No response from OpenAI");
    }
    return fullContent;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}

export async function chatWithTools(
  messages: Message[],
): Promise<string> {
  const openAITools = getAllTools().map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));

  console.log(openAITools)
  const history: Message[] = [...messages];

  for (let i = 0; i < 10; i++) {
    const response = await openai.chat.completions.create({
      model: "gpt-5-mini",
      messages: history,
      tools: openAITools,
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
        const args = JSON.parse(toolCall.function.arguments) as Record<string, unknown>;
        console.log(`[tool] 调用 ${toolCall.function.name}，参数:`, args);
        const tool = getTool(toolCall.function.name);
        const result = tool
          ? await tool.execute(args)
          : `Tool "${toolCall.function.name}" not found`;
        console.log(`[tool] 结果:`, result);

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

  throw new Error("Tool call loop exceeded 10 iterations");
}
