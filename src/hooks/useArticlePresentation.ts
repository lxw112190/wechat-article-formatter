import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import type { ImageAsset } from "../imageAssets";
import { getLocalAssetReferences } from "../markdown/assets";
import { getMarkdownOutline } from "../markdown/outline";
import { inspectBeforePublish } from "../markdown/preflight";
import { buildCopyHtml, buildCopyPlainText, buildExportHtml, renderMarkdown, stripMarkdown } from "../markdown/renderMarkdown";
import { openPrintPreview } from "../services/print";
import { themes } from "../themes/themes";

type UseArticlePresentationOptions = {
  title: string;
  markdown: string;
  imageAssets: ImageAsset[];
  assetUrls: Record<string, string>;
  assetLibraryReady: boolean;
};

export function useArticlePresentation(options: UseArticlePresentationOptions) {
  const [themeId, setThemeId] = useState(themes[0].id);
  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
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
    "--article-heading": theme.heading,
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

  return {
    themeId,
    setThemeId,
    themes,
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
  };
}
