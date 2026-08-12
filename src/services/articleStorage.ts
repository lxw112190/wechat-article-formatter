import type { Article, ArticleVersion, DeletedArticle } from "../types";

export const articleStorageKey = "wechat-publisher-articles";
export const historyStorageKey = "wechat-publisher-history";
export const articleStorageSchemaVersion = 2;

export type StorageRecovery = {
  storageKey: string;
  backupKey: string;
  raw: string;
  label: string;
};

export type ArticleLibraryData = {
  articles: Article[];
  trash: DeletedArticle[];
};

type StoredArticleLibrary = ArticleLibraryData & {
  schemaVersion: number;
};

type StoredHistory = {
  schemaVersion: number;
  history: ArticleVersion[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function preserveCorruptValue(storage: Storage, storageKey: string, raw: string, label: string): StorageRecovery {
  const backupKey = `${storageKey}-corrupt-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  try {
    storage.setItem(backupKey, raw);
  } catch {
    // The in-memory copy is still offered for download when storage is unavailable.
  }
  return { storageKey, backupKey, raw, label };
}

function safeGetItem(storage: Storage, key: string) {
  try {
    return storage.getItem(key) ?? "";
  } catch {
    return "";
  }
}

export function normalizeArticles(value: unknown, fallback: Article[] = []) {
  const source = Array.isArray(value) ? value : [];
  const usedIds = new Set<string>();
  const normalized: Article[] = source
    .filter((item): item is { id?: unknown; title?: unknown; markdown: string; updatedAt?: unknown; pinned?: unknown } =>
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
        ...(item.pinned === true ? { pinned: true } : {}),
      };
    });
  return normalized.length || source.length ? normalized : fallback;
}

export function normalizeTrash(value: unknown) {
  if (!Array.isArray(value)) return [];
  const articles = normalizeArticles(value);
  const deletedAtById = new Map(
    value
      .filter(isRecord)
      .map((item) => [typeof item.id === "string" ? item.id : "", typeof item.deletedAt === "string" ? item.deletedAt : ""]),
  );
  return articles.map((article) => ({
    ...article,
    deletedAt: deletedAtById.get(article.id) || new Date().toISOString(),
  })) satisfies DeletedArticle[];
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

function parseArticleLibrary(value: unknown, fallback: Article[] = []): ArticleLibraryData {
  if (Array.isArray(value)) return { articles: normalizeArticles(value, fallback), trash: [] };
  const record = isRecord(value) ? value : {};
  return {
    articles: normalizeArticles(record.articles, fallback),
    trash: normalizeTrash(record.trash),
  };
}

function assertSupportedLibrary(value: unknown) {
  if (Array.isArray(value)) return;
  if (!isRecord(value) || !Array.isArray(value.articles)) throw new Error("文章库结构无效");
  if (typeof value.schemaVersion === "number" && value.schemaVersion > articleStorageSchemaVersion)
    throw new Error("文章库来自更高版本的应用");
}

function parseHistory(value: unknown) {
  return normalizeHistory(isRecord(value) ? value.history : value);
}

function assertSupportedHistory(value: unknown) {
  if (Array.isArray(value)) return;
  if (!isRecord(value) || !Array.isArray(value.history)) throw new Error("历史版本结构无效");
  if (typeof value.schemaVersion === "number" && value.schemaVersion > articleStorageSchemaVersion)
    throw new Error("历史版本来自更高版本的应用");
}

export function loadArticleLibrary(storage: Storage, fallback: Article[]) {
  try {
    const saved = storage.getItem(articleStorageKey);
    if (!saved) return { data: { articles: fallback, trash: [] }, recovery: null };
    const value: unknown = JSON.parse(saved);
    assertSupportedLibrary(value);
    const data = parseArticleLibrary(value);
    return { data, recovery: null };
  } catch {
    const raw = safeGetItem(storage, articleStorageKey);
    return {
      data: { articles: fallback, trash: [] },
      recovery: preserveCorruptValue(storage, articleStorageKey, raw, "文章库"),
    };
  }
}

export function loadHistoryState(storage: Storage) {
  try {
    const saved = storage.getItem(historyStorageKey);
    if (!saved) return { history: [], recovery: null };
    const value: unknown = JSON.parse(saved);
    assertSupportedHistory(value);
    return { history: parseHistory(value), recovery: null };
  } catch {
    const raw = safeGetItem(storage, historyStorageKey);
    return {
      history: [],
      recovery: preserveCorruptValue(storage, historyStorageKey, raw, "历史版本"),
    };
  }
}

export function loadArticles(storage: Storage, fallback: Article[]) {
  return loadArticleLibrary(storage, fallback).data.articles;
}

export function loadHistory(storage: Storage) {
  return loadHistoryState(storage).history;
}

export function saveLibraryData(storage: Storage, articles: Article[], trash: DeletedArticle[]) {
  const payload: StoredArticleLibrary = {
    schemaVersion: articleStorageSchemaVersion,
    articles: normalizeArticles(articles),
    trash: normalizeTrash(trash),
  };
  storage.setItem(articleStorageKey, JSON.stringify(payload));
}

export function saveHistoryData(storage: Storage, history: ArticleVersion[]) {
  const payload: StoredHistory = {
    schemaVersion: articleStorageSchemaVersion,
    history: normalizeHistory(history),
  };
  storage.setItem(historyStorageKey, JSON.stringify(payload));
}

export function saveArticleData(storage: Storage, articles: Article[], history: ArticleVersion[], trash: DeletedArticle[] = []) {
  const previousArticles = storage.getItem(articleStorageKey);
  const previousHistory = storage.getItem(historyStorageKey);
  try {
    saveLibraryData(storage, articles, trash);
    saveHistoryData(storage, history);
  } catch (error) {
    if (previousArticles === null) storage.removeItem(articleStorageKey);
    else storage.setItem(articleStorageKey, previousArticles);
    if (previousHistory === null) storage.removeItem(historyStorageKey);
    else storage.setItem(historyStorageKey, previousHistory);
    throw error;
  }
}

export function parseLegacyLibrary(value: unknown) {
  const data = parseArticleLibrary(value);
  const articles = data.articles;
  if (!articles.length) throw new Error("备份中没有有效文章");
  return { articles, trash: data.trash };
}

function repairJson(raw: string) {
  const candidates = [raw.replace(/^\uFEFF/, ""), raw.replace(/^\uFEFF/, "").replace(/,\s*([}\]])/g, "$1")];
  const firstBracket = raw.indexOf("[");
  const lastBracket = raw.lastIndexOf("]");
  if (firstBracket >= 0 && lastBracket > firstBracket) candidates.push(raw.slice(firstBracket, lastBracket + 1));
  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as unknown;
    } catch {
      // Try the next conservative repair strategy.
    }
  }
  return null;
}

export function repairArticleLibrary(raw: string) {
  const value = repairJson(raw);
  if (value === null) return null;
  const data = parseArticleLibrary(value);
  return data.articles.length || data.trash.length ? data : null;
}

export function repairHistory(raw: string) {
  const value = repairJson(raw);
  if (value === null) return null;
  const history = parseHistory(value);
  return history;
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
