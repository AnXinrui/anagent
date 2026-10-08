import { parse } from "yaml";

/** 将 Markdown 拆分为 frontmatter 文本和正文，缺少合法 frontmatter 时按原文处理。 */
export function splitFrontmatter(raw: string): { yamlText: string; body: string } {
  const lines = raw.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return { yamlText: "", body: raw };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) {
    return { yamlText: "", body: raw };
  }

  return {
    yamlText: lines.slice(1, end).join("\n"),
    body: lines.slice(end + 1).join("\n"),
  };
}

/** 解析 frontmatter 为普通对象；缺失或解析结果非对象时返回空对象。 */
export function parseFrontmatter(raw: string): { data: Record<string, unknown>; body: string } {
  const { yamlText, body } = splitFrontmatter(raw);
  const parsed: unknown = yamlText ? parse(yamlText) : {};
  const data =
    parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  return { data, body };
}
