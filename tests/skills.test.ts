import { afterEach, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { parseFrontmatter, splitFrontmatter } from "../src/skills/frontmatter";
import type { Skill } from "../src/skills/listSkills";
import { buildSkillsPrompt, listSkills } from "../src/skills/listSkills";
import { parseUserPrompt } from "../src/skills/parseUserPrompt";
import { replaceArguments } from "../src/skills/replaceArguments";

const tempDirs: string[] = [];

/** 创建本次用例独占的技能根目录，结束后统一清理。 */
async function createSkillsRoot(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), "anagent-skills-"));
  tempDirs.push(dir);
  return dir;
}

/** 在技能根目录下写入一个技能目录及其 SKILL.md。 */
async function writeSkill(root: string, directory: string, content: string): Promise<void> {
  const skillDirectory = path.join(root, directory);
  await mkdir(skillDirectory, { recursive: true });
  await writeFile(path.join(skillDirectory, "SKILL.md"), content, "utf-8");
}

afterEach(async () => {
  for (const dir of tempDirs.splice(0)) {
    await rm(dir, { recursive: true, force: true });
  }
});

test("frontmatter 缺失或未闭合时正文按原文返回", () => {
  expect(splitFrontmatter("hello")).toEqual({ yamlText: "", body: "hello" });
  expect(splitFrontmatter("---\nname: x\n没有结束标记")).toEqual({
    yamlText: "",
    body: "---\nname: x\n没有结束标记",
  });
  expect(splitFrontmatter("---\nname: x\n---\n正文")).toEqual({
    yamlText: "name: x",
    body: "正文",
  });
});

test("parseFrontmatter 非对象 YAML 返回空数据", () => {
  expect(parseFrontmatter("---\n- a\n- b\n---\n正文")).toEqual({ data: {}, body: "正文" });
  expect(parseFrontmatter("---\n42\n---\n正文")).toEqual({ data: {}, body: "正文" });
});

test("listSkills 只读取含 SKILL.md 的子目录，名称缺省用目录名", async () => {
  expect(listSkills(path.join(tmpdir(), "anagent-skills-missing-root"))).toEqual([]);

  const root = await createSkillsRoot();
  await writeSkill(root, "apple", "---\nname: apple\ndescription: 苹果\ncontext: fork\n---\n正文一");
  await writeSkill(root, "no-name", "没有 frontmatter 的技能");
  await mkdir(path.join(root, "empty"), { recursive: true });
  await writeFile(path.join(root, "loose.md"), "非目录条目", "utf-8");

  const skills = listSkills(root);
  expect(skills).toHaveLength(2);
  expect(skills.find((skill) => skill.name === "apple")).toEqual({
    name: "apple",
    description: "苹果",
    context: "fork",
    body: "正文一",
  });
  expect(skills.find((skill) => skill.name === "no-name")).toEqual({
    name: "no-name",
    description: "",
    context: "",
    body: "没有 frontmatter 的技能",
  });
});

test("buildSkillsPrompt 空列表返回 null，否则列出技能并指引调用 Skill 工具", () => {
  expect(buildSkillsPrompt([])).toBeNull();
  const prompt = buildSkillsPrompt([{ name: "apple", description: "苹果", context: "", body: "" }]);
  expect(prompt).toContain("- apple: 苹果");
  expect(prompt).toContain("Skill tool");
});

test("replaceArguments 按占位符取参数，越界替换为空串", () => {
  expect(replaceArguments("$0 $1", ["a", "b"])).toBe("a b");
  expect(replaceArguments("全部: $ARGUMENTS", ["a", "b"])).toBe("全部: a b");
  expect(replaceArguments("$ARGUMENTS[1] 和 $ARGUMENTS[9]", ["a", "b"])).toBe("b 和 ");
  expect(replaceArguments("$2", ["a"])).toBe("");
});

test("parseUserPrompt 展开开头的 /技能名 并传参，未命中时保持原文", () => {
  const skills: Skill[] = [
    { name: "greet", description: "", context: "", body: "你好 $ARGUMENTS" },
    { name: "bye", description: "", context: "", body: "再见 $0" },
  ];
  expect(parseUserPrompt("普通消息", skills)).toBe("普通消息");
  expect(parseUserPrompt("/missing", skills)).toBe("/missing");
  expect(parseUserPrompt("/greet 小明 小红", skills)).toBe("你好 小明 小红");
  expect(parseUserPrompt("/greet /bye 阿强", skills)).toBe("你好 阿强\n再见 阿强");
  expect(parseUserPrompt("/greet", skills)).toBe("你好 ");
});
