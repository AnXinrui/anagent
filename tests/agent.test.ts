import { afterEach, beforeEach, describe, expect, mock, spyOn, test } from "bun:test";
import type OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { runLoop } from "../src/agent/loop";
import { registerTool } from "../src/tools/registry";

const create = mock(async (_request: Record<string, unknown>): Promise<unknown> => completion("回复"));
const client = { chat: { completions: { create } } } as unknown as OpenAI;
const originalModel = process.env.MODEL;

/** 构造只包含业务所读取字段的模型响应。 */
function completion(content: string | null) {
  return { choices: [{ finish_reason: "stop", message: { role: "assistant", content } }] };
}

/** 构造一次函数工具调用响应。 */
function toolCompletion(name = "echo", args = '{"value":"测试"}') {
  return {
    choices: [{
      finish_reason: "tool_calls",
      message: {
        role: "assistant",
        content: null,
        tool_calls: [{ id: "call-1", type: "function", function: { name, arguments: args } }],
      },
    }],
  };
}

beforeEach(() => {
  create.mockReset();
  create.mockImplementation(async () => completion("回复"));
  delete process.env.MODEL;
  spyOn(console, "log").mockImplementation(() => {});
  spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  mock.restore();
  if (originalModel === undefined) {
    delete process.env.MODEL;
  } else {
    process.env.MODEL = originalModel;
  }
});

describe("工具循环行为基线", () => {
  test("按顺序传回工具结果且不修改传入的消息数组", async () => {
    const execute = mock(async () => "工具结果");
    registerTool({ name: "echo", description: "回显", parameters: {}, execute });
    create.mockResolvedValueOnce(toolCompletion()).mockResolvedValueOnce(completion("完成"));
    const messages: ChatCompletionMessageParam[] = [{ role: "user", content: "查询" }];
    expect(await runLoop(client, messages)).toBe("完成");
    expect(messages).toHaveLength(1);
    expect(execute).toHaveBeenCalledWith({ value: "测试" });
    expect(create.mock.calls[1]?.[0]).toMatchObject({
      model: "gpt-5-mini",
      messages: [messages[0], toolCompletion().choices[0]!.message, {
        role: "tool", tool_call_id: "call-1", content: "工具结果",
      }],
    });
  });

  test("未知工具作为工具结果回传", async () => {
    create.mockResolvedValueOnce(toolCompletion("missing")).mockResolvedValueOnce(completion("完成"));
    await runLoop(client, []);
    expect(create.mock.calls[1]?.[0].messages).toContainEqual({
      role: "tool", tool_call_id: "call-1", content: 'Tool "missing" not found',
    });
  });

  test("参数解析失败和工具异常都作为工具结果回传", async () => {
    create.mockResolvedValueOnce(toolCompletion("echo", "invalid-json")).mockResolvedValueOnce(completion("完成"));
    expect(await runLoop(client, [])).toBe("完成");
    const parseFailureMessages = create.mock.calls[1]?.[0].messages as ChatCompletionMessageParam[];
    const parseFailureResult = parseFailureMessages.find((item) => item.role === "tool");
    expect(typeof parseFailureResult?.content).toBe("string");
    expect(parseFailureResult?.content).not.toBe("");

    registerTool({
      name: "broken", description: "失败工具", parameters: {},
      execute: async () => { throw new Error("工具失败"); },
    });
    create.mockResolvedValueOnce(toolCompletion("broken")).mockResolvedValueOnce(completion("完成"));
    expect(await runLoop(client, [])).toBe("完成");
    expect(create.mock.calls[3]?.[0].messages).toContainEqual({
      role: "tool", tool_call_id: "call-1", content: "工具失败",
    });
  });

  test("固定模型且十轮后抛出原错误", async () => {
    process.env.MODEL = "ignored-model";
    create.mockImplementation(async () => toolCompletion("missing"));
    await expect(runLoop(client, [])).rejects.toThrow("Tool call loop exceeded 10 iterations");
    expect(create).toHaveBeenCalledTimes(10);
    expect(create.mock.calls.every(([request]) => request.model === "gpt-5-mini")).toBe(true);
  });

  test("空 choices 抛错，空内容返回空字符串", async () => {
    create.mockResolvedValueOnce({ choices: [] });
    await expect(runLoop(client, [])).rejects.toThrow("No choice returned from OpenAI");
    create.mockResolvedValueOnce(completion(null));
    expect(await runLoop(client, [])).toBe("");
  });

  test("finish_reason 不是 tool_calls 时不执行工具", async () => {
    const response = toolCompletion("missing");
    response.choices[0]!.finish_reason = "stop";
    create.mockResolvedValueOnce(response);
    expect(await runLoop(client, [])).toBe("");
    expect(create).toHaveBeenCalledTimes(1);
  });
});
