import { useEffect, useState } from "react";
import { maxVersionsPerArticle } from "../app/config";
import { historyStorageKey, loadHistory } from "../services/articleStorage";
import type { Article, ArticleVersion } from "../types";

type UseArticleHistoryOptions = {
  onStorageError: (message: string) => void;
};

export function useArticleHistory({ onStorageError }: UseArticleHistoryOptions) {
  const [history, setHistory] = useState<ArticleVersion[]>(() => loadHistory(window.localStorage));

  useEffect(() => {
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch (error) {
      onStorageError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "历史版本保存失败：浏览器本地存储空间不足。正文仍可编辑，请尽快导出完整 ZIP 备份。"
          : "历史版本保存失败：无法写入浏览器本地存储。",
      );
    }
  }, [history, onStorageError]);

  function recordVersion(article: Article) {
    setHistory((items) => {
      const latest = items.find((version) => version.articleId === article.id);
      if (latest && latest.title === article.title && latest.markdown === article.markdown) return items;
      const version: ArticleVersion = {
        id: crypto.randomUUID(),
        articleId: article.id,
        title: article.title,
        markdown: article.markdown,
        savedAt: new Date().toISOString(),
      };
      const articleVersions = [version, ...items.filter((item) => item.articleId === article.id)].slice(0, maxVersionsPerArticle);
      return [...articleVersions, ...items.filter((item) => item.articleId !== article.id)];
    });
  }

  function removeArticleHistory(articleId: string) {
    setHistory((items) => items.filter((version) => version.articleId !== articleId));
  }

  return {
    history,
    recordVersion,
    removeArticleHistory,
    replaceHistory: setHistory,
  };
}
