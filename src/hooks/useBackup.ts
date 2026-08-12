import { useState } from "react";
import type { ChangeEvent } from "react";
import { appVersion } from "../app/config";
import { downloadBlob } from "../app/formatters";
import { getAllImageAssets, replaceAllImageAssets } from "../imageAssets";
import { createCompleteBackup, getBackupFilename, readCompleteBackup } from "../services/backup";
import { saveArticleData } from "../services/articleStorage";
import { defaultTheme, themes as builtInThemes } from "../themes/themes";
import type { Article, ArticleVersion, DeletedArticle, Theme } from "../types";

type UseBackupOptions = {
  articles: Article[];
  history: ArticleVersion[];
  trash: DeletedArticle[];
  themeId: string;
  customThemes: Theme[];
  syncScroll: boolean;
  outlineOpen: boolean;
  replaceLibrary: (articles: Article[], history: ArticleVersion[], trash: DeletedArticle[]) => void;
  setThemeId: (themeId: string) => void;
  replaceCustomThemes: (themes: Theme[]) => void;
  setSyncScroll: (enabled: boolean) => void;
  setOutlineOpen: (open: boolean) => void;
  refreshAssets: () => void;
  onError: (message: string) => void;
};

export function useBackup({
  articles,
  history,
  trash,
  themeId,
  customThemes,
  syncScroll,
  outlineOpen,
  replaceLibrary,
  setThemeId,
  replaceCustomThemes,
  setSyncScroll,
  setOutlineOpen,
  refreshAssets,
  onError,
}: UseBackupOptions) {
  const [backupMessage, setBackupMessage] = useState("");

  async function exportCompleteBackup() {
    setBackupMessage("正在打包…");
    onError("");
    try {
      const assets = await getAllImageAssets();
      const bytes = await createCompleteBackup(
        { articles, history, trash, assets, settings: { themeId, syncScroll, outlineOpen, customThemes } },
        appVersion,
      );
      downloadBlob(new Blob([bytes.slice().buffer], { type: "application/zip" }), getBackupFilename());
      setBackupMessage(`备份完成 · ${articles.length} 篇 / ${assets.length} 张图`);
    } catch (error) {
      setBackupMessage("备份失败");
      onError(error instanceof Error ? `完整备份失败：${error.message}` : "完整备份失败：无法读取本地数据");
    }
    window.setTimeout(() => setBackupMessage(""), 3200);
  }

  async function importCompleteBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBackupMessage("正在校验…");
    onError("");
    try {
      const restored = await readCompleteBackup(file);
      if (
        !window.confirm(
          `完整备份校验通过：\n\n• ${restored.articles.length} 篇文章\n• ${restored.trash.length} 篇回收站文章\n• ${restored.history.length} 条历史版本\n• ${restored.assets.length} 张图片\n• ${restored.settings.customThemes.length} 个自定义主题\n• 备份版本 V${restored.manifest.version}\n\n恢复将替换当前文章、回收站、历史、图片素材和自定义主题，是否继续？`,
        )
      ) {
        setBackupMessage("");
        return;
      }

      const previousAssets = await getAllImageAssets();
      const previousArticles = articles;
      const previousHistory = history;
      const previousTrash = trash;
      const previousThemes = customThemes;
      const previousThemeId = themeId;
      const previousSyncScroll = syncScroll;
      const previousOutlineOpen = outlineOpen;
      let assetsReplaced = false;
      try {
        await replaceAllImageAssets(restored.assets);
        assetsReplaced = true;
        saveArticleData(window.localStorage, restored.articles, restored.history, restored.trash);
        replaceCustomThemes(restored.settings.customThemes);
        const restoredThemeExists =
          builtInThemes.some((theme) => theme.id === restored.settings.themeId) ||
          restored.settings.customThemes.some((theme) => theme.id === restored.settings.themeId);
        setThemeId(restoredThemeExists ? restored.settings.themeId : defaultTheme.id);
        setSyncScroll(restored.settings.syncScroll);
        setOutlineOpen(restored.settings.outlineOpen);
        replaceLibrary(restored.articles, restored.history, restored.trash);
      } catch (error) {
        if (assetsReplaced) await replaceAllImageAssets(previousAssets).catch(() => undefined);
        try {
          saveArticleData(window.localStorage, previousArticles, previousHistory, previousTrash);
          replaceCustomThemes(previousThemes);
          setThemeId(previousThemeId);
          setSyncScroll(previousSyncScroll);
          setOutlineOpen(previousOutlineOpen);
          replaceLibrary(previousArticles, previousHistory, previousTrash);
        } catch {
          onError("恢复失败且自动回滚未能完整完成。请不要继续编辑，立即刷新页面并使用恢复前的完整 ZIP 备份。");
        }
        throw error;
      }
      refreshAssets();
      setBackupMessage(`恢复完成 · ${restored.articles.length} 篇 / ${restored.assets.length} 张图`);
    } catch (error) {
      setBackupMessage("恢复失败");
      onError(error instanceof Error ? `完整备份恢复失败：${error.message}` : "完整备份恢复失败");
    }
    window.setTimeout(() => setBackupMessage(""), 4000);
  }

  return { backupMessage, exportCompleteBackup, importCompleteBackup };
}
