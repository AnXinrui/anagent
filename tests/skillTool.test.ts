import { beforeEach, expect, mock, test } from "bun:test";
import type { Skill } from "../src/skills/listSkills";

let skills: Skill[] = [];
const runLoop = mock(async (_client: unknown, _messages: unknown[]) => "子上下文回复");
const client = {};
mock.module("../src/skills/listSkills", () => ({
  listSkills: () => skills,
  buildSkillsPrompt: () => null,
}));
mock.module("../src/agent/loop", () => ({ runLoop }));
mock.module("../src/agent/client", () => ({ client }));

const { skillTool } = await import("../src/tools/loadSkill");

beforeEach(() => {
  runLoop.mockClear();
  skills = [];
});

test("未知技能返回 unknown skill 且不触发子上下文", async () => {
  expect(await skillTool.execute({ name: "missing" })).toBe("unknown skill: missing");
  expect(runLoop).not.toHaveBeenCalled();
});

test("普通技能无参数时返回原始正文，有参数时替换占位符", async () => {
  skills = [{ name: "greet", description: "", context: "", body: "你好 $ARGUMENTS" }];
  expect(await skillTool.execute({ name: "greet" })).toBe("你好 $ARGUMENTS");
  expect(await skillTool.execute({ name: "greet", args: "小明 小红" })).toBe("你好 小明 小红");
});

test("fork 技能在独立上下文中执行并返回结果", async () => {
  skills = [{ name: "apple", description: "", context: "fork", body: "回答 $0" }];
  expect(await skillTool.execute({ name: "apple", args: "蓝莓" })).toBe(
    "Skill apple ran in a separate context and returned: 子上下文回复",
  );
  expect(runLoop).toHaveBeenCalledWith(client, [{ role: "user", content: "回答 蓝莓" }]);
});
