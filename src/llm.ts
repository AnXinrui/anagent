import "dotenv/config";
import { OpenAI } from "openai";

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
}

const openai = new OpenAI({
  apiKey: process.env.API_KEY,
  baseURL: process.env.BASE_URL,
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
