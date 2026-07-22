// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { themes } from "../themes/themes";
import { buildCopyHtml, renderMarkdown } from "./renderMarkdown";

describe("Markdown rendering", () => {
  it("renders GFM tables with inline styles", () => {
    const html = renderMarkdown("| 名称 | 值 |\n| --- | ---: |\n| 测试 | 1 |", themes[0]);
    expect(html).toContain("<table");
    expect(html).toContain("text-align:right");
  });

  it("copies local images as ID placeholders without Base64", () => {
    const rendered = renderMarkdown("![封面](asset://IMG-COVER)", themes[0], { "IMG-COVER": "blob:http://localhost/image" });
    const copied = buildCopyHtml(rendered, themes[0]);
    expect(copied).toContain("请上传图片：IMG-COVER");
    expect(copied).not.toContain("blob:");
    expect(copied).not.toContain("base64");
  });
});
