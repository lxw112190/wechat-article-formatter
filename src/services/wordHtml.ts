import { downloadBlob } from "../app/formatters";
import { getThemeFontFamily } from "../markdown/renderMarkdown";
import type { Theme } from "../types";
import { defaultWordExportSettings, normalizeWordExportSettings, sanitizeFileName } from "./word";
import type { WordExportSettings } from "./word";

export type WordCompatibleHtmlOptions = {
  title: string;
  bodyHtml: string;
  theme: Theme;
  settings?: WordExportSettings;
};

const mmToPixels = (millimeters: number) => Math.round((millimeters / 25.4) * 96);

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function fontFamily(theme: Theme, settings: WordExportSettings) {
  if (settings.fontFamily === "microsoft-yahei") return "'Microsoft YaHei','微软雅黑',sans-serif";
  if (settings.fontFamily === "simsun") return "SimSun,'宋体',serif";
  if (settings.fontFamily === "kaiti") return "KaiTi,'楷体',serif";
  if (settings.fontFamily === "fangsong") return "FangSong,'仿宋',serif";
  return getThemeFontFamily(theme);
}

function effectiveBodyFontSize(theme: Theme, settings: WordExportSettings) {
  return settings.bodyFontSize ?? Math.max(10.5, Math.round(theme.bodyFontSize * 0.75 * 10) / 10);
}

function normalizeWordHtmlBody(bodyHtml: string, title: string, settings: WordExportSettings) {
  const template = document.createElement("template");
  template.innerHTML = bodyHtml;
  template.content
    .querySelectorAll<HTMLElement>("[data-outline-index]")
    .forEach((element) => element.removeAttribute("data-outline-index"));
  if (settings.showTitle && settings.removeDuplicateTitle) {
    const first = template.content.firstElementChild;
    if (first?.tagName === "H1" && first.textContent?.trim() === title.trim()) first.remove();
  }
  template.content.querySelectorAll<HTMLElement>("section").forEach((section) => {
    section.style.maxWidth = "100%";
    section.style.overflow = "visible";
  });
  template.content.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.style.width = "100%";
    table.style.minWidth = "0";
    table.style.tableLayout = "fixed";
  });
  template.content.querySelectorAll<HTMLElement>("th,td,p,li,a").forEach((element) => {
    element.style.wordBreak = "break-word";
    element.style.overflowWrap = "anywhere";
  });
  template.content.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6,figure,blockquote,pre,tr").forEach((element) => {
    element.style.breakInside = "avoid";
    element.style.pageBreakInside = "avoid";
  });
  return template.innerHTML;
}

export function buildWordCompatibleHtml(options: WordCompatibleHtmlOptions) {
  const settings = normalizeWordExportSettings(options.settings ?? defaultWordExportSettings);
  const safeTitle = escapeHtml(options.title.trim() || "未命名文章");
  const body = normalizeWordHtmlBody(options.bodyHtml, options.title, settings);
  const paper = settings.pageSize === "a5" ? { width: "148mm", height: "210mm" } : { width: "210mm", height: "297mm" };
  const pageWidth = mmToPixels(settings.pageSize === "a5" ? 148 : 210) - mmToPixels(settings.marginLeft + settings.marginRight);
  const footer = settings.showFooterTitle || settings.showPageNumbers;
  const footerText = settings.showFooterTitle ? safeTitle : "";
  const bodyFontSize = effectiveBodyFontSize(options.theme, settings);
  const lineHeight = settings.lineHeight ?? options.theme.bodyLineHeight;
  return `<!doctype html>
<html lang="zh-CN" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Word.Document" />
  <meta name="Generator" content="公众号排版助手" />
  <meta name="Originator" content="公众号排版助手" />
  <!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View><w:DoNotOptimizeForBrowser/></w:WordDocument></xml><![endif]-->
  <title>${safeTitle}</title>
  <style>
    @page WordSection1 { size:${paper.width} ${paper.height}; margin:${settings.marginTop}mm ${settings.marginRight}mm ${settings.marginBottom}mm ${settings.marginLeft}mm; }
    div.WordSection1 { page:WordSection1; }
    body { margin:0; background:#fff; color:${options.theme.text}; font-family:${fontFamily(options.theme, settings)}; font-size:${bodyFontSize}pt; line-height:${lineHeight}; }
    .word-document { width:${pageWidth}px; max-width:100%; margin:0 auto; }
    .word-title { margin:0 0 22px; padding:0 0 14px; border-bottom:2px solid ${options.theme.accent}; color:${options.theme.headings.h1.color}; font-family:${fontFamily(options.theme, settings)}; font-size:${Math.max(18, options.theme.headings.h1.fontSize * 0.9)}pt; line-height:1.35; font-weight:800; text-align:${options.theme.headings.h1.align}; }
    .word-document img { max-width:100% !important; height:auto !important; }
    .word-document table { width:100% !important; min-width:0 !important; table-layout:fixed !important; border-collapse:collapse; }
    .word-document th, .word-document td { word-break:break-word; overflow-wrap:anywhere; }
    .word-document h1, .word-document h2, .word-document h3, .word-document h4, .word-document h5, .word-document h6 { page-break-after:avoid; break-after:avoid-page; }
    .word-document figure, .word-document blockquote, .word-document pre, .word-document tr { page-break-inside:avoid; break-inside:avoid-page; }
    .word-footer { margin-top:18px; padding-top:8px; border-top:1px solid ${options.theme.border}; color:${options.theme.muted}; font-size:9pt; text-align:center; }
    .word-footer .page:after { content:counter(page); }
  </style>
</head>
<body>
  <div class="WordSection1 word-document">
    ${settings.showTitle ? `<h1 class="word-title">${safeTitle}</h1>` : ""}
    ${body}
    ${footer ? `<div class="word-footer">${footerText}${settings.showFooterTitle && settings.showPageNumbers ? "　·　" : ""}${settings.showPageNumbers ? '<span>第 <span class="page"></span> 页</span>' : ""}</div>` : ""}
  </div>
</body>
</html>`;
}

async function embedImagesForStandaloneDocument(html: string) {
  const template = document.createElement("template");
  template.innerHTML = html;
  await Promise.all(
    Array.from(template.content.querySelectorAll<HTMLImageElement>("img")).map(async (image) => {
      const src = image.currentSrc || image.src;
      if (!src || src.startsWith("data:")) return;
      try {
        const response = await fetch(src);
        if (!response.ok) throw new Error("图片读取失败");
        const blob = await response.blob();
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => (typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("图片转换失败")));
          reader.onerror = () => reject(new Error("图片转换失败"));
          reader.readAsDataURL(blob);
        });
        image.src = dataUrl;
      } catch {
        const placeholder = document.createElement("p");
        placeholder.textContent = `【图片未能嵌入：${image.alt || "无图片说明"}】`;
        placeholder.setAttribute("style", "margin:10px 0;color:#667085;font-size:12px;text-align:center;");
        image.replaceWith(placeholder);
      }
    }),
  );
  return `<!doctype html>${template.innerHTML}`;
}

export async function exportWordCompatibleHtml(options: WordCompatibleHtmlOptions) {
  const html = await embedImagesForStandaloneDocument(buildWordCompatibleHtml(options));
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  downloadBlob(blob, `${sanitizeFileName(options.title)}-Word兼容版.html`);
}
