import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { client } from "../agent/client";
import { runLoop } from "../agent/loop";
import { listSkills } from "../skills/listSkills";
import { replaceArguments } from "../skills/replaceArguments";
import type { Tool } from "./Tool";

/** 加载技能指令的工具；fork 技能在独立上下文中执行后只返回结果。 */
export const skillTool: Tool = {
  name: "Skill",
  description: "Load a skill's instructions into the conversation",
  parameters: {
    type: "object",
    properties: {
      name: { type: "string", description: "The name of the skill to use" },
      args: { type: "string", description: "Optional arguments for the skill" },
    },
    required: ["name"],
  },
  /** 查找技能并返回替换参数后的指令正文。 */
  async execute(args): Promise<string> {
    const { name, args: rawArgs } = args as { name: string; args?: unknown };
    const skillArgs = typeof rawArgs === "string" ? rawArgs : "";
    const skill = listSkills().find((item) => item.name === name);
    if (!skill) {
      return `unknown skill: ${name}`;
    }

    const tokens = skillArgs ? skillArgs.split(/\s+/) : [];
    if (skill.context === "fork") {
      const prompt = replaceArguments(skill.body, tokens);
      const messages: ChatCompletionMessageParam[] = [{ role: "user", content: prompt }];
      const answer = await runLoop(client, messages);
      return `Skill ${skill.name} ran in a separate context and returned: ${answer}`;
    }
    if (tokens.length === 0) {
      return skill.body;
    }
    return replaceArguments(skill.body, tokens);
  },
};
