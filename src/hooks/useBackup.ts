import { useState } from "react";
import type { ChangeEvent } from "react";
import { appVersion } from "../app/config";
import { downloadBlob } from "../app/formatters";
import { getAllImageAssets, replaceAllImageAssets } from "../imageAssets";
import { createCompleteBackup, getBackupFilename, readCompleteBackup } from "../services/backup";
import { saveArticleData } from "../services/articleStorage";
import type { Article, ArticleVersion } from "../types";

type UseBackupOptions = {
  articles: Article[];
  history: ArticleVersion[];
  themeId: string;
  syncScroll: boolean;
  outlineOpen: boolean;
  replaceLibrary: (articles: Article[], history: ArticleVersion[]) => void;
  setThemeId: (themeId: string) => void;
  setSyncScroll: (enabled: boolean) => void;
  setOutlineOpen: (open: boolean) => void;
  refreshAssets: () => void;
  validThemeIds: string[];
  onError: (message: string) => void;
};

export function useBackup({
  articles,
  history,
  themeId,
  syncScroll,
  outlineOpen,
  replaceLibrary,
  setThemeId,
  setSyncScroll,
  setOutlineOpen,
  refreshAssets,
  validThemeIds,
  onError,
}: UseBackupOptions) {
  const [backupMessage, setBackupMessage] = useState("");

  async function exportCompleteBackup() {
    setBackupMessage("正在打包…");
    onError("");
    try {
      const assets = await getAllImageAssets();
      const bytes = await createCompleteBackup({ articles, history, assets, settings: { themeId, syncScroll, outlineOpen } }, appVersion);
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
          `完整备份校验通过：\n\n• ${restored.articles.length} 篇文章\n• ${restored.history.length} 条历史版本\n• ${restored.assets.length} 张图片\n• 备份版本 V${restored.manifest.version}\n\n恢复将替换当前文章、历史和图片素材，是否继续？`,
        )
      ) {
        setBackupMessage("");
        return;
      }

      const previousAssets = await getAllImageAssets();
      let assetsReplaced = false;
      try {
        await replaceAllImageAssets(restored.assets);
        assetsReplaced = true;
        saveArticleData(window.localStorage, restored.articles, restored.history);
      } catch (error) {
        if (assetsReplaced) await replaceAllImageAssets(previousAssets).catch(() => undefined);
        throw error;
      }

      replaceLibrary(restored.articles, restored.history);
      setThemeId(validThemeIds.includes(restored.settings.themeId) ? restored.settings.themeId : validThemeIds[0]);
      setSyncScroll(restored.settings.syncScroll);
      setOutlineOpen(restored.settings.outlineOpen);
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
