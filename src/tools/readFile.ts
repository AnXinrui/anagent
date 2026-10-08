import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import type { Tool } from "./Tool";

/** 读取文件内容的工具。 */
export const readFileTool: Tool = {
  name: "readFileContent",
  description: "Read and return the contents of a file",
  parameters: {
    type: "object",
    properties: {
      filePath: { type: "string", description: "The path to the file to read" },
    },
    required: ["filePath"],
  },
  /** 以 UTF-8 读取文件；文件不存在时抛出包含绝对路径的错误。 */
  async execute(args): Promise<string> {
    const { filePath } = args as { filePath: string };
    const resolvedPath = path.resolve(filePath);
    if (!existsSync(resolvedPath)) {
      throw new Error(`文件不存在: ${resolvedPath}`);
    }
    return readFileSync(resolvedPath, "utf-8");
  },
};
