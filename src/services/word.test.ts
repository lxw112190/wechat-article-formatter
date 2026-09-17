// @vitest-environment jsdom

import JSZip from "jszip";
import { Packer } from "docx";
import { describe, expect, it } from "vitest";
import { themes } from "../themes/themes";
import {
  buildWordDocument,
  defaultWordExportSettings,
  fitImageSize,
  getWordExportPreset,
  loadWordExportSettings,
  normalizeWordExportSettings,
  sanitizeFileName,
  saveWordExportSettings,
} from "./word";

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

  it("converts browser-normalized RGB token colors to Word hex colors", async () => {
    const document = await buildWordDocument({
      title: "高亮颜色",
      bodyHtml: '<pre><code><span data-code-token="keyword" style="color: rgb(15, 81, 50);">const</span> value</code></pre>',
      theme: themes[0],
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml).toContain("0F5132");
  });

  it("sanitizes filenames and fits images proportionally", () => {
    expect(sanitizeFileName("测试:/文章*?")).toBe("测试--文章--");
    expect(fitImageSize(1200, 600, 560)).toEqual({ width: 560, height: 280 });
  });

  it("removes a duplicate H1 and creates clickable bookmarks for the table of contents", async () => {
    const document = await buildWordDocument({
      title: "测试文章",
      bodyHtml: "<section><h1>测试文章</h1><h2>第一部分</h2><p>内容</p><h3>细节</h3></section>",
      theme: themes[0],
      settings: { ...defaultWordExportSettings, includeToc: true, tocDepth: 2 },
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    expect(xml.match(/测试文章/g)).toHaveLength(1);
    expect(xml).toContain("目录");
    expect(xml).toContain('w:anchor="word-heading-1"');
    expect(xml).toContain('w:name="word-heading-1"');
    expect(xml).toContain("第一部分");
    expect(xml).not.toContain('w:anchor="word-heading-2"');
  });

  it("exports merged table cells and formal page settings", async () => {
    const document = await buildWordDocument({
      title: "表格测试",
      bodyHtml:
        '<table><tr><th colspan="2">汇总</th></tr><tr><td rowspan="2">分类</td><td>第一项</td></tr><tr><td>第二项</td></tr></table>',
      theme: themes[0],
      settings: { ...getWordExportPreset("formal"), pageSize: "a5" },
    });
    const zip = await JSZip.loadAsync(await Packer.toBuffer(document));
    const xml = (await zip.file("word/document.xml")?.async("string")) ?? "";
    const styles = (await zip.file("word/styles.xml")?.async("string")) ?? "";
    expect(xml).toContain('w:gridSpan w:val="2"');
    expect(xml).toContain('w:vMerge w:val="restart"');
    expect(xml).toContain('w:pgSz w:w="8391" w:h="11906"');
    expect(styles).toContain("SimSun");
  });

  it("validates and persists Word export settings", () => {
    const memory = new Map<string, string>();
    const storage = {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
    };
    const settings = normalizeWordExportSettings({ pageSize: "a5", marginTop: 100, imageMaxWidth: 10, includeToc: true });
    expect(settings.marginTop).toBe(40);
    expect(settings.imageMaxWidth).toBe(280);
    expect(settings.bodyFontSize).toBeNull();
    expect(settings.lineHeight).toBeNull();
    saveWordExportSettings(storage, settings);
    expect(loadWordExportSettings(storage)).toEqual(settings);
  });
});
