import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Tool } from "./Tool";

/** 写入文件的工具。 */
export const writeFileTool: Tool = {
  name: "writeFile",
  description: "Write content to a file",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "The path of the file to write to" },
      content: { type: "string", description: "The content to write to the file" },
    },
    required: ["filePath", "content"],
  },
  /** 覆盖写入文件，父目录缺失时递归创建。 */
  async execute(args): Promise<string> {
    const { filePath, content } = args as { filePath: string; content: string };
    const dirPath = path.dirname(filePath);
    if (!existsSync(dirPath)) {
      mkdirSync(dirPath, { recursive: true });
      console.log(`📁 创建目录: ${dirPath}`);
    }
    writeFileSync(filePath, content, "utf-8");
    console.log(`✅ 文件已写入: ${filePath}`);
    return `文件已写入: ${filePath}`;
  },
};
