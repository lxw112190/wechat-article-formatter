// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import { convertPastedHtml } from "./pasteConverter";

describe("convertPastedHtml", () => {
  it("converts Word list paragraphs and removes hidden content", () => {
    const result = convertPastedHtml(
      '<p class="MsoListParagraph" style="mso-list:l0 level1 lfo1"><span style="mso-list:Ignore">1. </span>第一项</p><p style="display:none">隐藏</p>',
    );
    expect(result.source).toBe("Word");
    expect(result.markdown).toContain("1. 第一项");
    expect(result.markdown).not.toContain("隐藏");
  });

  it("turns embedded images into upload reminders", () => {
    const result = convertPastedHtml('<p>正文</p><img src="data:image/png;base64,AAAA" alt="截图">');
    expect(result.skippedImages).toBe(1);
    expect(result.markdown).toContain("图片需重新上传");
  });
});
