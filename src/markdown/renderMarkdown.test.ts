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

  it("applies structural settings from a custom theme", () => {
    const customTheme = {
      ...themes[0],
      headings: {
        ...themes[0].headings,
        h2: { ...themes[0].headings.h2, decoration: "pill" as const },
      },
      blockquoteStyle: "quote" as const,
      codeStyle: "dark" as const,
      tableStyle: "accent-header" as const,
      dividerStyle: "dashed" as const,
      imageStyle: "shadow" as const,
    };
    const html = renderMarkdown(
      "## 标题\n\n> 引用\n\n```ts\nconst ok = true\n```\n\n| 名称 | 值 |\n| --- | --- |\n| A | B |\n\n---\n\n![图](https://example.com/a.png)",
      customTheme,
    );
    const template = document.createElement("template");
    template.innerHTML = html;
    expect(template.content.querySelector("h2")?.style.borderRadius).toBe("999px");
    expect(template.content.querySelector("blockquote")?.style.textAlign).toBe("center");
    expect(template.content.querySelector("pre")?.style.background).toBe("rgb(31, 41, 55)");
    expect(template.content.querySelector("th")?.style.color).toBe("rgb(255, 255, 255)");
    expect(template.content.querySelector("hr")?.style.borderTopStyle).toBe("dashed");
    expect(template.content.querySelector("img")?.style.boxShadow).toContain("rgba");
  });

  it("applies expanded typography, heading and list settings", () => {
    const customTheme = {
      ...themes[0],
      fontFamily: "microsoft-yahei" as const,
      bodyTextAlign: "justify" as const,
      letterSpacing: 0.8,
      firstLineIndent: 2,
      unorderedListStyle: "square" as const,
      strongStyle: "highlight" as const,
      headings: {
        ...themes[0].headings,
        h4: {
          ...themes[0].headings.h4,
          fontSize: 21,
          align: "right" as const,
          decoration: "underline" as const,
        },
      },
    };
    const html = renderMarkdown("正文测试\n\n**重点**\n\n- 列表\n\n#### 四级标题", customTheme);
    const template = document.createElement("template");
    template.innerHTML = html;
    const paragraph = template.content.querySelector("p")!;
    expect(paragraph.style.fontFamily).toContain("Microsoft YaHei");
    expect(paragraph.style.textAlign).toBe("justify");
    expect(paragraph.style.textIndent).toBe("2em");
    expect(template.content.querySelector("ul")?.style.listStyleType).toBe("square");
    expect(template.content.querySelector("strong")?.style.background).not.toBe("");
    expect(template.content.querySelector("h4")?.style.fontSize).toBe("21px");
    expect(template.content.querySelector("h4")?.style.textAlign).toBe("right");
  });
});
