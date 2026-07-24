import { getThemeFontFamily } from "../markdown/renderMarkdown";
import type { Theme } from "../types";

export type PrintDocumentOptions = {
  title: string;
  bodyHtml: string;
  theme: Theme;
  exportedAt?: Date;
};

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function preparePrintBody(bodyHtml: string, title: string) {
  const template = document.createElement("template");
  template.innerHTML = bodyHtml;
  const firstElement = template.content.firstElementChild;
  if (firstElement?.tagName === "H1" && firstElement.textContent?.trim() === title.trim()) firstElement.remove();
  template.content
    .querySelectorAll<HTMLElement>("[data-outline-index]")
    .forEach((element) => element.removeAttribute("data-outline-index"));
  return template.innerHTML;
}

function formatExportTime(value: Date) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(value);
}

export function buildPrintDocument({ title, bodyHtml, theme, exportedAt = new Date() }: PrintDocumentOptions) {
  const safeTitle = escapeHtml(title.trim() || "未命名文章");
  const safeThemeName = escapeHtml(theme.name);
  const printBody = preparePrintBody(bodyHtml, title);
  const exportTime = escapeHtml(formatExportTime(exportedAt));
  const fontFamily = getThemeFontFamily(theme);

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${safeTitle}</title>
  <style>
    :root { color-scheme: light; }
    * { box-sizing: border-box; }
    html { background: #edf1ef; }
    body { margin: 0; color: ${theme.text}; background: #edf1ef; font-family: ${fontFamily}; }
    .print-toolbar { position: sticky; z-index: 10; top: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 64px; padding: 10px 22px; border-bottom: 1px solid #d8e0dc; background: rgba(255,255,255,.96); box-shadow: 0 8px 24px rgba(24,41,33,.08); }
    .print-toolbar strong { display: block; color: #1e3028; font-size: 14px; }
    .print-toolbar span { display: block; margin-top: 3px; color: #66746d; font-size: 12px; line-height: 1.45; }
    .print-actions { display: flex; flex: 0 0 auto; gap: 8px; }
    .print-actions button { min-height: 38px; padding: 0 14px; border: 1px solid #c7d4cd; border-radius: 8px; background: #fff; color: #34433c; font: inherit; font-size: 13px; font-weight: 750; cursor: pointer; }
    .print-actions button.primary { border-color: ${theme.heading}; background: ${theme.heading}; color: #fff; }
    .print-sheet { width: min(210mm, calc(100% - 32px)); min-height: 297mm; margin: 24px auto 40px; padding: 18mm 16mm 20mm; background: #fff; box-shadow: 0 18px 56px rgba(29,43,35,.14); }
    .document-header { margin-bottom: 28px; padding-bottom: 18px; border-bottom: 2px solid ${theme.accent}; }
    .document-header h1 { margin: 0 0 10px; color: ${theme.headings.h1.color}; font-size: ${theme.headings.h1.fontSize}px; line-height: 1.35; font-weight: 800; letter-spacing: ${theme.letterSpacing}px; text-align: ${theme.headings.h1.align}; }
    .document-meta { display: flex; flex-wrap: wrap; gap: 8px 16px; color: ${theme.muted}; font-size: 12px; line-height: 1.5; }
    .document-meta span:first-child { color: ${theme.accent}; font-weight: 750; }
    .document-body { overflow-wrap: anywhere; }
    .document-body img { max-width: 100% !important; height: auto !important; }
    .document-body h1, .document-body h2, .document-body h3, .document-body h4, .document-body h5, .document-body h6 { break-after: avoid-page; page-break-after: avoid; }
    .document-body p, .document-body li { orphans: 3; widows: 3; }
    .document-body figure, .document-body pre, .document-body blockquote { break-inside: avoid-page; page-break-inside: avoid; }
    .document-body section { max-width: 100% !important; }
    .document-body table { width: 100% !important; min-width: 0 !important; table-layout: fixed !important; }
    .document-body th, .document-body td { overflow-wrap: anywhere; word-break: break-word !important; }
    @page { size: A4 portrait; margin: 18mm 16mm 20mm; }
    @media print {
      html, body { background: #fff !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .print-toolbar { display: none !important; }
      .print-sheet { width: auto; min-height: 0; margin: 0; padding: 0; box-shadow: none; }
      .document-body section { overflow: visible !important; }
    }
    @media (max-width: 700px) {
      .print-toolbar { align-items: flex-start; flex-direction: column; padding: 12px 14px; }
      .print-actions { width: 100%; }
      .print-actions button { flex: 1; }
      .print-sheet { width: calc(100% - 20px); margin-top: 10px; padding: 24px 18px 36px; }
      .document-header h1 { font-size: 24px; }
    }
  </style>
</head>
<body>
  <header class="print-toolbar">
    <div><strong>打印预览</strong><span id="print-status">确认排版后，选择“打印 / 保存 PDF”；在系统对话框中选择“另存为 PDF”。</span></div>
    <div class="print-actions"><button type="button" onclick="window.close()">关闭</button><button class="primary" type="button" onclick="printWhenReady()">打印 / 保存 PDF</button></div>
  </header>
  <main class="print-sheet">
    <header class="document-header">
      <h1>${safeTitle}</h1>
      <div class="document-meta"><span>${safeThemeName}主题</span><span>生成时间：${exportTime}</span></div>
    </header>
    <article class="document-body">${printBody}</article>
  </main>
  <script>
    async function printWhenReady() {
      const status = document.getElementById("print-status");
      const pendingImages = Array.from(document.images).filter((image) => !image.complete);
      if (pendingImages.length) {
        status.textContent = "正在等待图片加载完成…";
        await Promise.all(pendingImages.map((image) => new Promise((resolve) => {
          image.addEventListener("load", resolve, { once: true });
          image.addEventListener("error", resolve, { once: true });
        })));
      }
      status.textContent = "请在系统打印对话框中选择打印机，或选择“另存为 PDF”。";
      window.print();
    }
  </script>
</body>
</html>`;
}

export function openPrintPreview(options: PrintDocumentOptions) {
  const previewUrl = URL.createObjectURL(new Blob([buildPrintDocument(options)], { type: "text/html;charset=utf-8" }));
  const previewWindow = window.open(previewUrl, "_blank", "popup=yes,width=980,height=900");
  if (!previewWindow) {
    URL.revokeObjectURL(previewUrl);
    return false;
  }
  previewWindow.opener = null;
  previewWindow.focus();
  window.setTimeout(() => URL.revokeObjectURL(previewUrl), 60_000);
  return true;
}
