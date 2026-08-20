import { describe, expect, it } from "vitest";
import { classifyLink, formatLinkAsPlainText, isWechatArticleUrl, summarizeMarkdownLinks } from "./links";

describe("Markdown link compatibility", () => {
  it("recognizes WeChat article links without private attributes", () => {
    expect(isWechatArticleUrl("https://mp.weixin.qq.com/s/ABC")).toBe(true);
    expect(classifyLink("https://mp.weixin.qq.com/s?__biz=demo")).toBe("wechat-article");
    expect(isWechatArticleUrl("https://github.com/demo")).toBe(false);
  });

  it("keeps external link URLs when converting to plain text", () => {
    expect(formatLinkAsPlainText("GitHub", "https://github.com/demo")).toBe("GitHub（https://github.com/demo）");
    expect(formatLinkAsPlainText("https://github.com/demo", "https://github.com/demo")).toBe("https://github.com/demo");
    expect(formatLinkAsPlainText("联系我们", "mailto:test@example.com")).toBe("联系我们（test@example.com）");
  });

  it("summarizes explicit, autolink and bare URL forms", () => {
    expect(
      summarizeMarkdownLinks(
        "[文章](https://mp.weixin.qq.com/s/ABC) [项目](https://github.com/demo)\n<mailto:test@example.com>\nhttp://example.com",
      ),
    ).toEqual({ wechatArticleCount: 1, externalHttpsCount: 1, insecureHttpCount: 1, mailtoCount: 1, emptyCount: 0 });
  });
});
