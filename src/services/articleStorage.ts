import type { Article, ArticleVersion } from "../types";

export const articleStorageKey = "wechat-publisher-articles";
export const historyStorageKey = "wechat-publisher-history";

export function normalizeArticles(value: unknown, fallback: Article[] = []) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set<string>();
  return source
    .filter((item): item is { id?: unknown; title?: unknown; markdown: string; updatedAt?: unknown } =>
      Boolean(item && typeof item === "object" && typeof (item as { markdown?: unknown }).markdown === "string"),
    )
    .map((item) => {
      const id = typeof item.id === "string" && item.id && !usedIds.has(item.id) ? item.id : crypto.randomUUID();
      usedIds.add(id);
      return {
        id,
        title: typeof item.title === "string" ? item.title : "未命名文章",
        markdown: item.markdown,
        updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString(),
      };
    })
    .concat(source.length ? [] : fallback);
}

export function normalizeHistory(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ArticleVersion =>
    Boolean(
      item &&
      typeof item === "object" &&
      typeof item.id === "string" &&
      typeof item.articleId === "string" &&
      typeof item.title === "string" &&
      typeof item.markdown === "string" &&
      typeof item.savedAt === "string",
    ),
  );
}

export function loadArticles(storage: Storage, fallback: Article[]) {
  try {
    const saved = storage.getItem(articleStorageKey);
    const articles = normalizeArticles(saved ? JSON.parse(saved) : null);
    return articles.length ? articles : fallback;
  } catch {
    return fallback;
  }
}

export function loadHistory(storage: Storage) {
  try {
    const saved = storage.getItem(historyStorageKey);
    return normalizeHistory(saved ? JSON.parse(saved) : null);
  } catch {
    return [];
  }
}

export function saveArticleData(storage: Storage, articles: Article[], history: ArticleVersion[]) {
  const previousArticles = storage.getItem(articleStorageKey);
  const previousHistory = storage.getItem(historyStorageKey);
  try {
    storage.setItem(articleStorageKey, JSON.stringify(articles));
    storage.setItem(historyStorageKey, JSON.stringify(history));
  } catch (error) {
    if (previousArticles === null) storage.removeItem(articleStorageKey);
    else storage.setItem(articleStorageKey, previousArticles);
    if (previousHistory === null) storage.removeItem(historyStorageKey);
    else storage.setItem(historyStorageKey, previousHistory);
    throw error;
  }
}

export function parseLegacyLibrary(value: unknown) {
  const record = value && typeof value === "object" ? (value as { articles?: unknown }) : null;
  const articles = normalizeArticles(Array.isArray(value) ? value : record?.articles);
  if (!articles.length) throw new Error("备份中没有有效文章");
  return articles;
}

export function getMarkdownTitle(markdown: string, filename: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fileTitle = filename.replace(/\.(md|markdown)$/i, "").trim();
  return heading || fileTitle || "导入的文章";
}

export function getMarkdownFilename(title: string) {
  const safeName = title
    .trim()
    .replace(/[<>:"/\\|?*]/g, "-")
    .split("")
    .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
    .join("")
    .replace(/[. ]+$/g, "")
    .slice(0, 80);
  return `${safeName || "未命名文章"}.md`;
}
