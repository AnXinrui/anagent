import type { Skill } from "./listSkills";
import { replaceArguments } from "./replaceArguments";

/** 展开消息开头的 /技能名 指令为技能正文并按占位符传入参数；未命中技能时原样返回。 */
export function parseUserPrompt(content: string, skills: Skill[]): string {
  const tokens = content.split(/\s+/);
  const matchedSkills: Skill[] = [];
  let start = 0;

  for (let index = 0; index < tokens.length; index++) {
    const token = tokens[index] ?? "";
    if (!token.startsWith("/")) {
      start = index;
      break;
    }

    const skill = skills.find((item) => item.name === token.slice(1));
    if (!skill) {
      start = index;
      break;
    }

    matchedSkills.push(skill);
    start = index + 1;
  }

  if (matchedSkills.length === 0) {
    return content;
  }

  const args = tokens.slice(start);
  return matchedSkills.map((skill) => replaceArguments(skill.body, args)).join("\n");
}
