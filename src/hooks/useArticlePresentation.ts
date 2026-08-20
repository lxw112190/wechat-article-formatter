import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ImageAsset } from "../imageAssets";
import { getLocalAssetReferences } from "../markdown/assets";
import { getMarkdownOutline } from "../markdown/outline";
import { inspectBeforePublish } from "../markdown/preflight";
import {
  buildCopyHtml,
  buildCopyPlainText,
  buildExportHtml,
  getThemeFontFamily,
  renderMarkdown,
  stripMarkdown,
} from "../markdown/renderMarkdown";
import { openPrintPreview } from "../services/print";
import { exportWordDocument, loadWordExportSettings, normalizeWordExportSettings, saveWordExportSettings } from "../services/word";
import type { WordExportSettings } from "../services/word";
import { useThemeLibrary } from "./useThemeLibrary";

type UseArticlePresentationOptions = {
  title: string;
  markdown: string;
  imageAssets: ImageAsset[];
  assetUrls: Record<string, string>;
  assetLibraryReady: boolean;
  onError: (message: string) => void;
};

export function useArticlePresentation(options: UseArticlePresentationOptions) {
  const themeLibrary = useThemeLibrary(options.onError);
  const [wordExporting, setWordExporting] = useState(false);
  const [wordExportOpen, setWordExportOpen] = useState(false);
  const [wordSettings, setWordSettingsState] = useState(() => loadWordExportSettings(window.localStorage));
  const { theme } = themeLibrary;
  const outline = useMemo(() => getMarkdownOutline(options.markdown), [options.markdown]);
  const bodyHtml = useMemo(() => renderMarkdown(options.markdown, theme, options.assetUrls), [options.markdown, theme, options.assetUrls]);
  const copyHtml = useMemo(() => buildCopyHtml(bodyHtml, theme), [bodyHtml, theme]);
  const plainText = useMemo(() => stripMarkdown(options.markdown), [options.markdown]);
  const copyPlainText = useMemo(() => buildCopyPlainText(options.markdown), [options.markdown]);
  const localAssets = useMemo(() => getLocalAssetReferences(options.markdown), [options.markdown]);
  const preflightIssues = useMemo(
    () => inspectBeforePublish(options.title, options.markdown, plainText, outline, options.imageAssets, options.assetLibraryReady),
    [options.title, options.markdown, plainText, outline, options.imageAssets, options.assetLibraryReady],
  );
  const characterCount = plainText.replace(/\s/g, "").length;
  const imageCount = (options.markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const themeVars = {
    "--article-accent": theme.accent,
    "--article-soft": theme.accentSoft,
    "--article-heading": theme.headings.h1.color,
    "--article-font": getThemeFontFamily(theme),
    "--article-title-align": theme.headings.h1.align,
    "--article-title-size": `${Math.min(36, theme.headings.h1.fontSize + 1)}px`,
  } as CSSProperties;

  function exportHtml() {
    const url = URL.createObjectURL(new Blob([buildExportHtml(options.title, bodyHtml, theme)], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wechat-article.html";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function printOrSavePdf() {
    if (!openPrintPreview({ title: options.title, bodyHtml, theme }))
      window.alert("打印预览窗口被浏览器拦截。请允许本站打开弹出窗口后重试。");
  }

  function updateWordSettings(settings: WordExportSettings) {
    const normalized = normalizeWordExportSettings(settings);
    setWordSettingsState(normalized);
    try {
      saveWordExportSettings(window.localStorage, normalized);
    } catch (error) {
      options.onError(error instanceof Error ? `Word 设置保存失败：${error.message}` : "Word 设置保存失败。当前仍可继续导出。");
    }
  }

  async function exportWord() {
    if (wordExporting) return;
    setWordExporting(true);
    try {
      await exportWordDocument({ title: options.title, bodyHtml, theme, settings: wordSettings });
      setWordExportOpen(false);
    } catch (error) {
      options.onError(error instanceof Error ? `Word 导出失败：${error.message}` : "Word 导出失败。");
    } finally {
      setWordExporting(false);
    }
  }

  return {
    ...themeLibrary,
    outline,
    bodyHtml,
    copyHtml,
    copyPlainText,
    localAssets,
    preflightIssues,
    preflightErrors: preflightIssues.filter((issue) => issue.status === "error"),
    characterCount,
    imageCount,
    readMinutes: Math.max(1, Math.ceil(characterCount / 450)),
    themeVars,
    exportHtml,
    printOrSavePdf,
    exportWord,
    wordExporting,
    wordExportOpen,
    setWordExportOpen,
    wordSettings,
    updateWordSettings,
  };
}
