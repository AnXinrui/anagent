import { currentDateTimeTool } from "./getCurrentDateTime";
import { skillTool } from "./loadSkill";
import { readFileTool } from "./readFile";
import { registerTool } from "./registry";
import { runCommandTool } from "./runCommand";
import { writeFileTool } from "./writeFile";

/** 注册默认工具集（CLI 与 QQ 入口共用）。 */
export function registerDefaultTools(): void {
  registerTool(currentDateTimeTool);
  registerTool(readFileTool);
  registerTool(writeFileTool);
  registerTool(runCommandTool);
  registerTool(skillTool);
}
