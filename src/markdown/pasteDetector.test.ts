// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { detectPasteContent, getMarkdownScore, htmlTextMatchesPlainText } from "./pasteDetector";

describe("pasteDetector", () => {
  it("keeps Markdown copied from a syntax highlighted editor", () => {
    const text = "## SimdPaddleOCR\n\n这是 **纯 C#** OCR。\n\n- Windows\n- Linux";
    const html = `<pre><span>${text}</span></pre>`;
    const result = detectPasteContent(text, html);
    expect(result.type).toBe("markdown");
    expect(result.reason).toBe("markdown-source-with-html-wrapper");
  });

  it("recognizes fenced code, tables and task lists as Markdown", () => {
    const text = '## Demo\n\n```csharp\nConsole.WriteLine("Hello");\n```\n\n- [x] 完成\n\n| 项目 | 状态 |\n| --- | --- |\n| A | ✅ |';
    expect(getMarkdownScore(text)).toBeGreaterThanOrEqual(8);
    expect(detectPasteContent(text, "<pre>wrapped source</pre>").type).toBe("markdown");
  });

  it("recognizes Word before Markdown-like lists", () => {
    expect(detectPasteContent("1. 第一项\n2. 第二项", '<p class="MsoListParagraph">1. 第一项</p>').type).toBe("word");
  });

  it("recognizes rich HTML and ignores meaningless wrappers", () => {
    expect(
      detectPasteContent(
        "这是重要内容，点击项目地址",
        '<p>这是<strong>重要</strong>内容，<a href="https://github.com/demo">项目地址</a></p>',
      ).type,
    ).toBe("rich-html");
    expect(detectPasteContent("这是一段普通文字", "<div><span>这是一段普通文字</span></div>").type).toBe("plain-text");
  });

  it("compares normalized HTML text and plain text", () => {
    expect(htmlTextMatchesPlainText("普通\r\n文本", "<div>普通\n文本</div>")).toBe(true);
  });
});
