import { describe, expect, it } from "vitest";
import {
  articleStorageSchemaVersion,
  loadArticleLibrary,
  normalizeArticles,
  normalizeHistory,
  parseLegacyLibrary,
  repairArticleLibrary,
  saveLibraryData,
} from "./articleStorage";

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

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
    expect(parseLegacyLibrary([{ id: "a", markdown: "# A" }]).articles).toHaveLength(1);
    expect(parseLegacyLibrary({ articles: [{ id: "b", markdown: "# B" }] }).articles).toHaveLength(1);
  });

  it("filters invalid history records", () => {
    expect(normalizeHistory([{ id: "v", articleId: "a", title: "A", markdown: "# A", savedAt: "2026-01-01" }, { id: "bad" }])).toHaveLength(
      1,
    );
  });

  it("writes schema V2 and keeps trash and pinned state", () => {
    const storage = createMemoryStorage();
    saveLibraryData(
      storage,
      [{ id: "a", title: "A", markdown: "# A", updatedAt: "2026-01-01", pinned: true }],
      [{ id: "b", title: "B", markdown: "# B", updatedAt: "2026-01-01", deletedAt: "2026-01-02" }],
    );
    const value = JSON.parse(storage.getItem("wechat-publisher-articles")!);
    expect(value.schemaVersion).toBe(articleStorageSchemaVersion);
    const loaded = loadArticleLibrary(storage, []);
    expect(loaded.data.articles[0].pinned).toBe(true);
    expect(loaded.data.trash[0].deletedAt).toBe("2026-01-02");
  });

  it("preserves corrupt data and can repair trailing commas", () => {
    const storage = createMemoryStorage();
    storage.setItem("wechat-publisher-articles", '[{"id":"a","markdown":"# A",}]');
    const loaded = loadArticleLibrary(storage, []);
    expect(loaded.recovery?.raw).toContain('"markdown"');
    expect(repairArticleLibrary(loaded.recovery!.raw)?.articles).toHaveLength(1);
    expect(Array.from({ length: storage.length }, (_, index) => storage.key(index)).some((key) => key?.includes("-corrupt-"))).toBe(true);
  });

  it("repairs a library that only contains trash", () => {
    const repaired = repairArticleLibrary(
      '{"schemaVersion":2,"articles":[],"trash":[{"id":"b","title":"B","markdown":"# B","deletedAt":"2026-01-02",}],}',
    );
    expect(repaired?.articles).toEqual([]);
    expect(repaired?.trash).toHaveLength(1);
  });

  it("keeps an intentionally empty active library when articles are in trash", () => {
    const storage = createMemoryStorage();
    saveLibraryData(storage, [], [{ id: "b", title: "B", markdown: "# B", updatedAt: "2026-01-01", deletedAt: "2026-01-02" }]);
    const loaded = loadArticleLibrary(storage, [{ id: "starter", title: "示例", markdown: "# 示例", updatedAt: "2026-01-01" }]);
    expect(loaded.data.articles).toEqual([]);
    expect(loaded.data.trash).toHaveLength(1);
  });
});
