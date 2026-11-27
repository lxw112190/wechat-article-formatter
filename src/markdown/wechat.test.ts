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
    expect(copied).toContain("项目<br>https://github.com/demo");
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
    const markdown =
      "# 标题\n\n[项目](https://github.com/demo)。\n\n- [x] 完成\n  - 子项\n- [ ] 待办\n\n~~~text\n  a\n\n    b\n~~~\n\n![封面](asset://IMG-COVER)";
    const plain = buildCopyPlainText(renderMarkdown(markdown, themes[0]), themes[0]);
    expect(plain).toBe(
      "标题\n\n项目\nhttps://github.com/demo 。\n\n• ☑ 完成\n  • 子项\n• ☐ 待办\n\n  a\n\n    b\n\n请上传图片：IMG-COVER；说明：封面",
    );
  });

  it("keeps caption typography on a paragraph only for WeChat copy", () => {
    const html = renderMarkdown("![说明](https://example.com/a.png)", themes[0]);
    const copied = document.createRange().createContextualFragment(buildCopyHtml(html, themes[0]));
    expect(html).toContain("<figcaption");
    expect(copied.querySelector("figcaption")).toBeNull();
    const caption = copied.querySelector<HTMLElement>("figure > p");
    expect(caption?.textContent).toBe("说明");
    expect(caption?.style.textAlign).toBe("center");
    expect(caption?.style.fontSize).toBe("13px");
  });

  it("shows relative images as placeholders instead of site image requests in both clipboard formats", () => {
    const html = renderMarkdown("![封面](images/my-cover.jpg)\n\n[![内联](./a.png)](https://example.com/)", themes[0]);
    const copied = document.createRange().createContextualFragment(buildCopyHtml(html, themes[0]));
    expect(copied.querySelector("img")).toBeNull();
    expect(copied.textContent).toContain("待关联图片：images/my-cover.jpg；说明：封面");
    expect(copied.textContent).toContain("待关联图片：./a.png；说明：内联");
    expect(buildCopyPlainText(html, themes[0])).toContain("待关联图片：images/my-cover.jpg");
  });

  it.each([
    ["images/my-cover.jpg", {}, "待关联图片：images/my-cover.jpg"],
    ["asset://IMG-COVER", {}, "请上传图片：IMG-COVER"],
    ["asset://IMG-COVER", { "IMG-COVER": "blob:http://localhost/cover" }, "请上传图片：IMG-COVER"],
  ])("keeps the clipboard placeholder for %s compact between text and a heading", (source, assets, label) => {
    const html = renderMarkdown(`普通段落\n\n前一段\n\n![封面](${source})\n\n## 下一节`, themes[0], assets);
    const copied = document.createRange().createContextualFragment(buildCopyHtml(html, themes[0]));
    const [ordinary, previous, placeholder, heading] = Array.from(copied.querySelectorAll<HTMLElement>("div > *"));
    expect(ordinary.style.marginBottom).toBe("18px");
    expect(previous.style.marginBottom).toBe("8px");
    expect(placeholder.tagName).toBe("P");
    expect(placeholder.textContent).toContain(label);
    expect(placeholder.style.marginBottom).toBe("8px");
    expect(placeholder.style.paddingTop).toBe("4px");
    expect(heading.style.marginTop).toBe("12px");
    expect(copied.querySelector("[data-image-placeholder], section, img")).toBeNull();
  });
});
