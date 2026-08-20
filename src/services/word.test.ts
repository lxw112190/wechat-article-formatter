// @vitest-environment jsdom

import JSZip from "jszip";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { themes } from "../themes/themes";
import { buildWordDocument, fitImageSize, sanitizeFileName } from "./word";

describe("Word export", () => {
  it("creates styled OOXML with headings, links, quotes, code, tables and a footer", async () => {
    const document = await buildWordDocument({
      title: "测试文章",
      bodyHtml:
        '<h2>小标题</h2><p>正文 <strong>重点</strong> <a href="https://github.com/demo">项目</a></p><blockquote><p>引用内容</p></blockquote><pre><code>const a = 1;\nconsole.log(a);</code></pre><table><tr><th>名称</th><td>值</td></tr></table>',
      theme: themes[0],
    });
    const bytes = await Packer.toBuffer(document);
    const zip = await JSZip.loadAsync(bytes);
    const xml = await zip.file("word/document.xml")?.async("string");
    const styles = await zip.file("word/styles.xml")?.async("string");
    const rels = await zip.file("word/_rels/document.xml.rels")?.async("string");
    const footer = await zip.file("word/footer1.xml")?.async("string");
    expect(xml).toContain("测试文章");
    expect(xml).toContain("小标题");
    expect(xml).toContain("w:tbl");
    expect(xml).toContain("w:keepNext");
    expect(xml).toContain("w:shd");
    expect(xml).toContain("w:br");
    expect(xml).toContain("w:footerReference");
    expect(styles).toContain("Microsoft YaHei");
    expect(styles).toContain("12B76A");
    expect(footer).toContain("测试文章");
    expect(footer).toContain('w:instrText xml:space="preserve">PAGE</w:instrText>');
    expect(rels).toContain("https://github.com/demo");
  });

  it("sanitizes filenames and fits images proportionally", () => {
    expect(sanitizeFileName("测试:/文章*?")).toBe("测试--文章--");
    expect(fitImageSize(1200, 600, 560)).toEqual({ width: 560, height: 280 });
  });
});
