import { exec } from "node:child_process";
import { promisify } from "node:util";
import type { Tool } from "./Tool";

const execAsync = promisify(exec);

/** 执行 shell 命令的工具。 */
export const runCommandTool: Tool = {
  name: "runCommand",
  description: "Execute a shell command",
  parameters: {
    type: "object",
    properties: {
      command: { type: "string", description: "The command to execute" },
    },
    required: ["command"],
  },
  /** 等待命令结束并返回去除首尾空白的标准输出，执行失败时保留原错误抛出。 */
  async execute(args): Promise<string> {
    const { command } = args as { command: string };
    try {
      const { stdout, stderr } = await execAsync(command);
      if (stderr) {
        console.error("错误:", stderr);
      }
      return stdout.trim();
    } catch (error) {
      console.error("执行失败:", error);
      throw error;
    }
  },
};
