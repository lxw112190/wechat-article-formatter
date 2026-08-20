// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { themes } from "../themes/themes";
import { buildCopyHtml, buildCopyPlainText, renderMarkdown } from "./renderMarkdown";

describe("WeChat copy compatibility", () => {
  it("preserves WeChat article links and downgrades external links", () => {
    const html = renderMarkdown("[文章](https://mp.weixin.qq.com/s/ABC) [项目](https://github.com/demo)", themes[0]);
    const copied = buildCopyHtml(html, themes[0]);
    expect(copied).toContain('href="https://mp.weixin.qq.com/s/ABC"');
    expect(copied).not.toContain('href="https://github.com/demo"');
    expect(copied).toContain("项目（https://github.com/demo）");
  });

  it("replaces task checkboxes and keeps nested list order", () => {
    const html = renderMarkdown("- [x] A\n  - B\n    - C\n- [ ] D", themes[0]);
    const copied = buildCopyHtml(html, themes[0]);
    expect(copied).not.toContain("checkbox");
    expect(copied).toContain("☑");
    expect(copied).toContain("☐");
    const text = Array.from(document.createRange().createContextualFragment(copied).querySelectorAll("p"))
      .map((paragraph) => paragraph.textContent?.trim())
      .filter(Boolean)
      .join("|");
    expect(text.indexOf("A")).toBeLessThan(text.indexOf("B"));
    expect(text.indexOf("B")).toBeLessThan(text.indexOf("C"));
  });

  it("keeps link URLs in plain-text clipboard fallback", () => {
    const plain = buildCopyPlainText("[项目](https://github.com/demo)\n\n- [x] 完成\n- [ ] 待办");
    expect(plain).toContain("项目（https://github.com/demo）");
    expect(plain).toContain("☑ 完成");
    expect(plain).toContain("☐ 待办");
  });
});
