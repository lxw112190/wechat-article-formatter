import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { initialArticles } from "../app/config";
import { downloadBlob } from "../app/formatters";
import { cloneArticleImageAssets, deleteUnusedImageAssets, describeStorageError } from "../imageAssets";
import { getReferencedAssetIds } from "../markdown/assets";
import {
  getMarkdownFilename,
  getMarkdownTitle,
  loadArticleLibrary,
  parseLegacyLibrary,
  repairArticleLibrary,
  saveLibraryData,
} from "../services/articleStorage";
import type { Article, ArticleVersion, DeletedArticle } from "../types";

export type ArticleSort = "updated-desc" | "updated-asc" | "title";

type UseArticleLibraryOptions = {
  history: ArticleVersion[];
  recordVersion: (article: Article) => void;
  removeArticleHistory: (articleId: string) => void;
  replaceHistory: (history: ArticleVersion[]) => void;
  onError: (message: string) => void;
};

export function useArticleLibrary({ history, recordVersion, removeArticleHistory, replaceHistory, onError }: UseArticleLibraryOptions) {
  const initial = useMemo(() => loadArticleLibrary(window.localStorage, initialArticles), []);
  const [articles, setArticles] = useState(initial.data.articles);
  const [trash, setTrash] = useState<DeletedArticle[]>(initial.data.trash);
  const [storageRecovery, setStorageRecovery] = useState(initial.recovery);
  const [searchQuery, setSearchQuery] = useState("");
  const [articleSort, setArticleSort] = useState<ArticleSort>("updated-desc");
  const [activeId, setActiveId] = useState(initial.data.articles[0]?.id ?? "");
  const [markdown, setMarkdown] = useState(initial.data.articles[0]?.markdown ?? "");
  const [title, setTitle] = useState(initial.data.articles[0]?.title ?? "");
  const [saved, setSaved] = useState("立即保存");
  const [storageError, setStorageError] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [markdownMessage, setMarkdownMessage] = useState("");

  const activeArticle = articles.find((article) => article.id === activeId);
  const isDirty = Boolean(activeArticle && (activeArticle.title !== title || activeArticle.markdown !== markdown));
  const hasUnsavedChanges = isDirty || storageError;
  const visibleArticles = useMemo(() => {
    const query = searchQuery.trim().toLocaleLowerCase();
    const filtered = query
      ? articles.filter((article) => `${article.title}\n${article.markdown}`.toLocaleLowerCase().includes(query))
      : articles;
    return [...filtered].sort((left, right) => {
      if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
      if (articleSort === "title") return left.title.localeCompare(right.title, "zh-CN");
      const difference = Date.parse(left.updatedAt) - Date.parse(right.updatedAt);
      return articleSort === "updated-asc" ? difference : -difference;
    });
  }, [articleSort, articles, searchQuery]);

  useEffect(() => {
    if (storageRecovery) return;
    try {
      saveLibraryData(window.localStorage, articles, trash);
      setStorageError(false);
    } catch (error) {
      setStorageError(true);
      setSaved("本地存储空间不足");
      onError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "文章自动保存失败：浏览器本地存储空间不足。请立即导出完整 ZIP 备份并清理旧草稿。"
          : "文章自动保存失败：无法写入浏览器本地存储。请导出完整 ZIP 备份后刷新页面重试。",
      );
    }
  }, [articles, onError, storageRecovery, trash]);

  function persistCurrentArticle(source: "手动保存" | "自动保存" = "手动保存") {
    const current = articles.find((article) => article.id === activeId);
    if (!current) return;
    if (current.title === title && current.markdown === markdown) {
      try {
        saveLibraryData(window.localStorage, articles, trash);
        setStorageError(false);
        setSaved("已保存");
      } catch (error) {
        setStorageError(true);
        setSaved("本地存储空间不足");
        onError(
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "手动保存失败：浏览器本地存储空间不足。请立即导出完整 ZIP 备份。"
            : "手动保存失败：无法写入浏览器本地存储。",
        );
      }
      return;
    }
    recordVersion(current);
    const updatedAt = new Date().toISOString();
    setArticles((items) =>
      items.map((item) => (item.id === activeId ? { ...item, title: title || "未命名文章", markdown, updatedAt } : item)),
    );
    setSaved(source === "自动保存" ? "已自动保存" : "已保存");
    window.setTimeout(() => setSaved("立即保存"), 1600);
  }

  function selectArticle(article: Article) {
    if (article.id === activeId) return;
    if (isDirty) persistCurrentArticle("自动保存");
    setActiveId(article.id);
    setTitle(article.title);
    setMarkdown(article.markdown);
    setSaved("立即保存");
  }

  function createArticle() {
    if (isDirty) persistCurrentArticle("自动保存");
    const article: Article = {
      id: crypto.randomUUID(),
      title: "未命名文章",
      markdown: "# 未命名文章\n\n开始写作...",
      updatedAt: new Date().toISOString(),
    };
    setArticles((items) => [article, ...items]);
    setActiveId(article.id);
    setTitle(article.title);
    setMarkdown(article.markdown);
    setSaved("立即保存");
  }

  async function duplicateArticle() {
    if (isDirty) persistCurrentArticle("自动保存");
    const current = getCurrentArticles().find((article) => article.id === activeId);
    if (!current) return;
    const duplicatedId = crypto.randomUUID();
    try {
      const cloned = await cloneArticleImageAssets(current.id, duplicatedId, current.markdown);
      const duplicated: Article = {
        ...current,
        id: duplicatedId,
        title: `${current.title || "未命名文章"} 副本`,
        markdown: cloned.markdown,
        updatedAt: new Date().toISOString(),
        pinned: false,
      };
      setArticles((items) => [duplicated, ...items]);
      setActiveId(duplicated.id);
      setTitle(duplicated.title);
      setMarkdown(duplicated.markdown);
      setSaved(cloned.assets.length ? `副本已创建 · ${cloned.assets.length} 张图片` : "副本已创建");
    } catch (error) {
      onError(describeStorageError(error, "复制文章图片"));
    }
  }

  function togglePinned(articleId: string) {
    setArticles((items) => items.map((item) => (item.id === articleId ? { ...item, pinned: !item.pinned } : item)));
  }

  function deleteArticle() {
    const current = getCurrentArticles().find((article) => article.id === activeId);
    if (!current || !window.confirm(`将“${current.title || "未命名文章"}”移入回收站吗？可稍后恢复。`)) return;
    if (isDirty) recordVersion(articles.find((article) => article.id === activeId) ?? current);
    const remaining = articles.filter((article) => article.id !== activeId);
    setTrash((items) => [{ ...current, deletedAt: new Date().toISOString() }, ...items.filter((item) => item.id !== current.id)]);
    setArticles(remaining);
    const next = remaining[0];
    setActiveId(next?.id ?? "");
    setTitle(next?.title ?? "");
    setMarkdown(next?.markdown ?? "");
    setSaved("立即保存");
  }

  function restoreFromTrash(articleId: string) {
    const article = trash.find((item) => item.id === articleId);
    if (!article) return;
    if (isDirty) persistCurrentArticle("自动保存");
    const { deletedAt: _deletedAt, ...restored } = article;
    const restoredArticle = { ...restored, updatedAt: new Date().toISOString() };
    setTrash((items) => items.filter((item) => item.id !== articleId));
    setArticles((items) => [restoredArticle, ...items]);
    setActiveId(restoredArticle.id);
    setTitle(restoredArticle.title);
    setMarkdown(restoredArticle.markdown);
    setSaved("已从回收站恢复");
  }

  function cleanupUnusedAssets(nextArticles: Article[], nextTrash: DeletedArticle[], removedArticleIds: Set<string>) {
    removedArticleIds.forEach(removeArticleHistory);
    const remainingHistory = history.filter((version) => !removedArticleIds.has(version.articleId));
    const referencedIds = getReferencedAssetIds([
      ...nextArticles.map((article) => article.markdown),
      ...nextTrash.map((article) => article.markdown),
      ...remainingHistory.map((version) => version.markdown),
    ]);
    void deleteUnusedImageAssets(referencedIds).catch((error) => onError(describeStorageError(error, "清理未使用图片")));
  }

  function permanentlyDeleteArticle(articleId: string) {
    const article = trash.find((item) => item.id === articleId);
    if (!article || !window.confirm(`彻底删除“${article.title || "未命名文章"}”吗？正文、历史和未使用图片将无法恢复。`)) return;
    const nextTrash = trash.filter((item) => item.id !== articleId);
    setTrash(nextTrash);
    cleanupUnusedAssets(articles, nextTrash, new Set([articleId]));
  }

  function emptyTrash() {
    if (!trash.length || !window.confirm(`彻底清空回收站中的 ${trash.length} 篇文章吗？此操作无法撤销。`)) return;
    const removedIds = new Set(trash.map((article) => article.id));
    setTrash([]);
    cleanupUnusedAssets(articles, [], removedIds);
  }

  function restoreVersion(version: ArticleVersion) {
    if (!window.confirm("确定恢复该历史版本吗？当前内容会先保存到历史记录。")) return;
    if (activeId) recordVersion({ id: activeId, title: title || "未命名文章", markdown, updatedAt: new Date().toISOString() });
    setTitle(version.title);
    setMarkdown(version.markdown);
    setSaved("已恢复，等待保存");
  }

  async function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMarkdownMessage("文件超过 5MB");
      window.setTimeout(() => setMarkdownMessage(""), 1800);
      return;
    }
    try {
      const content = (await file.text()).replace(/^\uFEFF/, "");
      if (!content.trim()) throw new Error("empty markdown");
      if (isDirty) persistCurrentArticle("自动保存");
      const article: Article = {
        id: crypto.randomUUID(),
        title: getMarkdownTitle(content, file.name),
        markdown: content,
        updatedAt: new Date().toISOString(),
      };
      setArticles((items) => [article, ...items]);
      setActiveId(article.id);
      setTitle(article.title);
      setMarkdown(article.markdown);
      setSaved("已导入并保存");
      setMarkdownMessage("导入成功");
    } catch {
      setMarkdownMessage("导入失败");
    }
    window.setTimeout(() => setMarkdownMessage(""), 1800);
  }

  function exportMarkdown() {
    if (!activeId) return;
    downloadBlob(new Blob([markdown], { type: "text/markdown;charset=utf-8" }), getMarkdownFilename(title));
    setMarkdownMessage("已导出");
    window.setTimeout(() => setMarkdownMessage(""), 1600);
  }

  function exportLibrary() {
    const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), articles }, null, 2);
    downloadBlob(new Blob([content], { type: "application/json;charset=utf-8" }), "wechat-article-library.json");
    setLibraryMessage("已导出");
    window.setTimeout(() => setLibraryMessage(""), 1600);
  }

  async function importLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = parseLegacyLibrary(JSON.parse(await file.text()));
      if (!window.confirm(`将用导入的 ${imported.articles.length} 篇文章替换当前文章库，是否继续？`)) return;
      replaceLibrary(imported.articles, [], imported.trash);
      setSaved("已导入并保存");
      setLibraryMessage("已导入");
    } catch {
      setLibraryMessage("导入失败");
    }
    window.setTimeout(() => setLibraryMessage(""), 1800);
  }

  function replaceLibrary(nextArticles: Article[], nextHistory?: ArticleVersion[], nextTrash: DeletedArticle[] = []) {
    const first = nextArticles[0];
    setArticles(nextArticles);
    if (nextHistory) replaceHistory(nextHistory);
    setTrash(nextTrash);
    setActiveId(first?.id ?? "");
    setTitle(first?.title ?? "");
    setMarkdown(first?.markdown ?? "");
    setStorageError(false);
  }

  function getCurrentArticles() {
    return articles.map((article) =>
      article.id === activeId ? { ...article, title: title || "未命名文章", markdown, updatedAt: new Date().toISOString() } : article,
    );
  }

  function downloadCorruptLibrary() {
    if (!storageRecovery) return;
    downloadBlob(new Blob([storageRecovery.raw], { type: "application/json;charset=utf-8" }), "wechat-corrupt-article-library.json");
  }

  function repairCorruptLibrary() {
    if (!storageRecovery) return false;
    const repaired = repairArticleLibrary(storageRecovery.raw);
    if (!repaired) return false;
    replaceLibrary(repaired.articles, undefined, repaired.trash);
    setStorageRecovery(null);
    return true;
  }

  function discardCorruptLibrary() {
    replaceLibrary(initialArticles, undefined, []);
    setStorageRecovery(null);
  }

  return {
    articles,
    visibleArticles,
    trash,
    searchQuery,
    articleSort,
    storageRecovery,
    activeId,
    title,
    markdown,
    saved,
    storageError,
    libraryMessage,
    markdownMessage,
    isDirty,
    hasUnsavedChanges,
    setTitle,
    setMarkdown,
    setSaved,
    setSearchQuery,
    setArticleSort,
    selectArticle,
    createArticle,
    duplicateArticle,
    togglePinned,
    deleteArticle,
    restoreFromTrash,
    permanentlyDeleteArticle,
    emptyTrash,
    restoreVersion,
    persistCurrentArticle,
    importMarkdown,
    exportMarkdown,
    exportLibrary,
    importLibrary,
    replaceLibrary,
    getCurrentArticles,
    downloadCorruptLibrary,
    repairCorruptLibrary,
    discardCorruptLibrary,
  };
}
