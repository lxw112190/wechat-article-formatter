import { describe, expect, it } from "vitest";
import { getMarkdownOutline } from "./outline";
import { inspectBeforePublish } from "./preflight";

describe("inspectBeforePublish", () => {
  it("reports missing local images as an error", () => {
    const markdown = "# 正常标题\n\n这里是一段足够进行检查的正文内容。\n\n![示意图](asset://IMG-MISSING)";
    const issues = inspectBeforePublish("正常标题", markdown, "这里是一段足够进行检查的正文内容。", getMarkdownOutline(markdown), [], true);
    expect(issues.find((issue) => issue.id === "images")?.status).toBe("error");
  });

  it("warns about heading jumps and insecure links", () => {
    const markdown = "# 标题\n\n### 跳级\n\n[链接](http://example.org)";
    const issues = inspectBeforePublish(
      "文章标题",
      markdown,
      "这是一段用于发布检查的正文内容，长度超过最低要求。",
      getMarkdownOutline(markdown),
      [],
      true,
    );
    expect(issues.find((issue) => issue.id === "outline")?.status).toBe("warning");
    expect(issues.find((issue) => issue.id === "links")?.status).toBe("warning");
  });
});
