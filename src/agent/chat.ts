import type OpenAI from "openai";
import type {
  ChatCompletionMessage,
  ChatCompletionMessageParam,
} from "openai/resources/chat/completions";

const DEFAULT_MODEL = "gpt-3.5-turbo";
const PRELIMINARY_REQUEST_COUNT = 10;

/** 按现有普通对话流程请求模型，返回最后一次响应中的助手消息。 */
export async function chat(
  client: OpenAI,
  messages: ChatCompletionMessageParam[],
): Promise<ChatCompletionMessage> {
  try {
    // 保留现有的十次前置请求；调整请求次数属于独立的行为变更。
    for (let turn = 0; turn < PRELIMINARY_REQUEST_COUNT; turn++) {
      const response = await client.chat.completions.create({
        model: process.env.MODEL || DEFAULT_MODEL,
        messages,
      });
      const message = response.choices[0]?.message;
      if (!message) {
        throw new Error("no choices in response");
      }
    }

    const response = await client.chat.completions.create({
      model: process.env.MODEL || DEFAULT_MODEL,
      messages,
    });
    const choice = response.choices[0];
    if (!choice) {
      throw new Error("OpenAI 返回空 choices");
    }
    return choice.message;
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw error;
  }
}
