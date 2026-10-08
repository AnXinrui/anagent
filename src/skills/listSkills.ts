import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { parseFrontmatter } from "./frontmatter";

const DEFAULT_SKILLS_DIRECTORY = ".claude/skills";

/** 技能元数据及其指令正文。 */
export interface Skill {
  /** 技能名，frontmatter 未声明时沿用目录名。 */
  name: string;
  /** 技能用途，用于生成系统提示词中的技能清单。 */
  description: string;
  /** 执行上下文；为 fork 时技能在独立上下文中运行。 */
  context: string;
  /** 去掉 frontmatter 后的指令正文。 */
  body: string;
}

/** 扫描技能根目录，读取每个子目录中的 SKILL.md，目录缺失时返回空列表。 */
export function listSkills(root = DEFAULT_SKILLS_DIRECTORY): Skill[] {
  if (!existsSync(root)) {
    return [];
  }

  const skills: Skill[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }

    const filePath = path.join(root, entry.name, "SKILL.md");
    if (!existsSync(filePath)) {
      continue;
    }

    const rawMarkdown = readFileSync(filePath, "utf-8");
    const { data, body } = parseFrontmatter(rawMarkdown);
    skills.push({
      name: typeof data.name === "string" ? data.name : entry.name,
      description: typeof data.description === "string" ? data.description : "",
      context: typeof data.context === "string" ? data.context : "",
      body,
    });
  }
  return skills;
}

/** 生成供系统提示词注入的技能清单，没有技能时返回 null。 */
export function buildSkillsPrompt(skills: Skill[]): string | null {
  if (skills.length === 0) {
    return null;
  }

  const lines = skills.map((skill) => `- ${skill.name}: ${skill.description}`);
  return [
    "You have access to the following skills:",
    "",
    ...lines,
    "",
    "If a skill matches the user's request, call the Skill tool with its name and follow the instructions it returns.",
  ].join("\n");
}
