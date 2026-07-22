import { describe, expect, it } from "vitest";
import { getMarkdownOutline } from "./outline";

describe("getMarkdownOutline", () => {
  it("recognizes ATX and Setext headings", () => {
    const outline = getMarkdownOutline("# 一级\n\n二级标题\n---\n\n### [链接](https://example.com) **强调**");
    expect(outline.map(({ level, text, line }) => ({ level, text, line }))).toEqual([
      { level: 1, text: "一级", line: 1 },
      { level: 2, text: "二级标题", line: 3 },
      { level: 3, text: "链接 强调", line: 6 },
    ]);
  });

  it("ignores headings inside fenced code", () => {
    expect(getMarkdownOutline("## 正文\n```md\n# 代码标题\n```\n### 结尾").map((item) => item.text)).toEqual(["正文", "结尾"]);
  });
});
