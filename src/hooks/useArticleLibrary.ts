import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent } from "react";
import { initialArticles } from "../app/config";
import { downloadBlob } from "../app/formatters";
import { deleteUnusedImageAssets, describeStorageError } from "../imageAssets";
import { getReferencedAssetIds } from "../markdown/assets";
import { articleStorageKey, getMarkdownFilename, getMarkdownTitle, loadArticles, parseLegacyLibrary } from "../services/articleStorage";
import type { Article, ArticleVersion } from "../types";

type UseArticleLibraryOptions = {
  history: ArticleVersion[];
  recordVersion: (article: Article) => void;
  removeArticleHistory: (articleId: string) => void;
  replaceHistory: (history: ArticleVersion[]) => void;
  onError: (message: string) => void;
};

export function useArticleLibrary({ history, recordVersion, removeArticleHistory, replaceHistory, onError }: UseArticleLibraryOptions) {
  const initial = useMemo(() => loadArticles(window.localStorage, initialArticles), []);
  const [articles, setArticles] = useState(initial);
  const [activeId, setActiveId] = useState(initial[0]?.id ?? "");
  const [markdown, setMarkdown] = useState(initial[0]?.markdown ?? "");
  const [title, setTitle] = useState(initial[0]?.title ?? "");
  const [saved, setSaved] = useState("立即保存");
  const [storageError, setStorageError] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [markdownMessage, setMarkdownMessage] = useState("");

  const activeArticle = articles.find((article) => article.id === activeId);
  const isDirty = Boolean(activeArticle && (activeArticle.title !== title || activeArticle.markdown !== markdown));
  const hasUnsavedChanges = isDirty || storageError;

  useEffect(() => {
    try {
      window.localStorage.setItem(articleStorageKey, JSON.stringify(articles));
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
  }, [articles, onError]);

  function persistCurrentArticle(source: "手动保存" | "自动保存" = "手动保存") {
    const current = articles.find((article) => article.id === activeId);
    if (!current) return;
    if (current.title === title && current.markdown === markdown) {
      try {
        window.localStorage.setItem(articleStorageKey, JSON.stringify(articles));
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

  function deleteArticle() {
    const current = articles.find((article) => article.id === activeId);
    if (!current || !window.confirm(`确定删除“${current.title || "未命名文章"}”吗？`)) return;
    const remaining = articles.filter((article) => article.id !== activeId);
    const remainingHistory = history.filter((version) => version.articleId !== activeId);
    const referencedIds = getReferencedAssetIds([
      ...remaining.map((article) => article.markdown),
      ...remainingHistory.map((version) => version.markdown),
    ]);
    void deleteUnusedImageAssets(referencedIds).catch((error) => onError(describeStorageError(error, "清理未使用图片")));
    setArticles(remaining);
    removeArticleHistory(activeId);
    const next = remaining[0];
    setActiveId(next?.id ?? "");
    setTitle(next?.title ?? "");
    setMarkdown(next?.markdown ?? "");
    setSaved("立即保存");
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
      if (!window.confirm(`将用导入的 ${imported.length} 篇文章替换当前文章库，是否继续？`)) return;
      replaceLibrary(imported, []);
      setSaved("已导入并保存");
      setLibraryMessage("已导入");
    } catch {
      setLibraryMessage("导入失败");
    }
    window.setTimeout(() => setLibraryMessage(""), 1800);
  }

  function replaceLibrary(nextArticles: Article[], nextHistory?: ArticleVersion[]) {
    const first = nextArticles[0];
    setArticles(nextArticles);
    if (nextHistory) replaceHistory(nextHistory);
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

  return {
    articles,
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
    selectArticle,
    createArticle,
    deleteArticle,
    restoreVersion,
    persistCurrentArticle,
    importMarkdown,
    exportMarkdown,
    exportLibrary,
    importLibrary,
    replaceLibrary,
    getCurrentArticles,
  };
}
