import { describe, expect, it } from "vitest";
import { normalizeArticles, normalizeHistory, parseLegacyLibrary } from "./articleStorage";

describe("article storage normalization", () => {
  it("drops invalid articles and repairs duplicate IDs", () => {
    const articles = normalizeArticles([
      { id: "same", title: "第一篇", markdown: "# A", updatedAt: "2026-01-01" },
      { id: "same", title: "第二篇", markdown: "# B" },
      { id: "bad", title: "无正文" },
    ]);
    expect(articles).toHaveLength(2);
    expect(articles[0].id).toBe("same");
    expect(articles[1].id).not.toBe("same");
  });

  it("accepts legacy array and object backups", () => {
    expect(parseLegacyLibrary([{ id: "a", markdown: "# A" }])).toHaveLength(1);
    expect(parseLegacyLibrary({ articles: [{ id: "b", markdown: "# B" }] })).toHaveLength(1);
  });

  it("filters invalid history records", () => {
    expect(normalizeHistory([{ id: "v", articleId: "a", title: "A", markdown: "# A", savedAt: "2026-01-01" }, { id: "bad" }])).toHaveLength(
      1,
    );
  });
});
