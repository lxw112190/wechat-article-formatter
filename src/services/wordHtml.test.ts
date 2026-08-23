// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { themes } from "../themes/themes";
import { defaultWordExportSettings, getWordExportPreset } from "./word";
import { buildWordCompatibleHtml } from "./wordHtml";

describe("Word compatible HTML export", () => {
  it("creates a standalone Word/WPS-friendly HTML document with shared page settings", () => {
    const html = buildWordCompatibleHtml({
      title: "导出测试",
      bodyHtml:
        '<h1 style="color:red">导出测试</h1><h2>小标题</h2><p>正文 <a href="https://example.com">链接</a></p><table><tr><th>名称</th><td>值</td></tr></table>',
      theme: themes[0],
      settings: { ...getWordExportPreset("formal"), pageSize: "a5" },
    });
    expect(html).toContain('content="Word.Document"');
    expect(html).toContain("@page WordSection1");
    expect(html).toContain("size:148mm 210mm");
    expect(html).toContain("SimSun");
    expect(html).toContain("小标题");
    expect(html).toContain("table-layout:fixed");
    expect(html).not.toContain('<h1 style="color:red">导出测试</h1>');
  });

  it("honors title and footer visibility options", () => {
    const html = buildWordCompatibleHtml({
      title: "无页眉测试",
      bodyHtml: "<p>正文</p>",
      theme: themes[0],
      settings: { ...defaultWordExportSettings, showTitle: false, showFooterTitle: false, showPageNumbers: false },
    });
    expect(html).not.toContain('class="word-title"');
    expect(html).not.toContain('class="word-footer"');
  });
});
