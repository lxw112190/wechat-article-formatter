import DOMPurify from "dompurify";
import { marked } from "marked";
import type { Theme } from "../types";
import { escapeHtml, localAssetPattern, prepareAssetMarkdown } from "./assets";

export function stripMarkdown(value: string) {
  const template = document.createElement("template");
  const withAssetLabels = value.replace(localAssetPattern, (_match, alt: string) => (alt ? `【图片：${alt}】` : "【图片】"));
  template.innerHTML = DOMPurify.sanitize(marked.parse(withAssetLabels, { async: false, gfm: true }));
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function renderMarkdown(markdown: string, theme: Theme, assetUrls: Record<string, string> = {}) {
  const rawHtml = marked.parse(prepareAssetMarkdown(markdown), { async: false, gfm: true, breaks: false });
  const template = document.createElement("template");
  template.innerHTML = DOMPurify.sanitize(rawHtml, { FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"] });

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => element.removeAttribute("style"));
  template.content
    .querySelectorAll<HTMLElement>("p")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `margin:0 0 18px;color:${theme.text};font-size:16px;line-height:1.85;letter-spacing:0;word-break:break-word;`,
      ),
    );

  const headingStyles: Record<string, string> = {
    H1: `margin:0 0 22px;color:${theme.heading};font-size:24px;line-height:1.35;font-weight:800;`,
    H2: `margin:34px 0 16px;padding-left:12px;border-left:4px solid ${theme.accent};color:${theme.heading};font-size:20px;line-height:1.45;font-weight:750;`,
    H3: `margin:26px 0 12px;color:${theme.heading};font-size:17px;line-height:1.5;font-weight:700;`,
    H4: `margin:22px 0 10px;color:${theme.heading};font-size:16px;line-height:1.55;font-weight:700;`,
    H5: `margin:20px 0 8px;color:${theme.heading};font-size:15px;line-height:1.6;font-weight:700;`,
    H6: `margin:18px 0 8px;color:${theme.muted};font-size:14px;line-height:1.6;font-weight:700;`,
  };
  template.content.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((element, index) => {
    element.setAttribute("style", headingStyles[element.tagName]);
    element.dataset.outlineIndex = String(index);
  });
  const firstHeading = template.content.querySelector<HTMLElement>("h2");
  if (firstHeading && !firstHeading.previousElementSibling) firstHeading.style.marginTop = "0";

  template.content
    .querySelectorAll<HTMLElement>("strong")
    .forEach((element) => element.setAttribute("style", `color:${theme.heading};font-weight:700;`));
  template.content
    .querySelectorAll<HTMLElement>("em")
    .forEach((element) => element.setAttribute("style", `color:${theme.muted};font-style:italic;`));
  template.content
    .querySelectorAll<HTMLElement>("del")
    .forEach((element) =>
      element.setAttribute("style", `color:${theme.muted};text-decoration:line-through;text-decoration-thickness:1.5px;`),
    );
  template.content.querySelectorAll<HTMLElement>("a").forEach((element) => {
    element.setAttribute(
      "style",
      `color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.border};word-break:break-all;`,
    );
    element.setAttribute("rel", "noopener noreferrer");
  });
  template.content
    .querySelectorAll<HTMLElement>("code")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `padding:2px 6px;border-radius:4px;background:${theme.codeBg};color:${theme.heading};font-family:SFMono-Regular,Consolas,Liberation Mono,Courier New,monospace;font-size:90%;word-break:break-word;`,
      ),
    );
  template.content.querySelectorAll<HTMLElement>("pre").forEach((element) => {
    element.setAttribute(
      "style",
      `margin:8px 0 22px;padding:16px;border-radius:6px;background:${theme.codeBg};border:1px solid ${theme.border};overflow-x:auto;color:${theme.heading};font-size:14px;line-height:1.7;white-space:pre;`,
    );
    element
      .querySelector<HTMLElement>("code")
      ?.setAttribute("style", "padding:0;border-radius:0;background:transparent;color:inherit;font:inherit;white-space:pre;");
  });
  template.content
    .querySelectorAll<HTMLElement>("blockquote")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `margin:8px 0 22px;padding:14px 16px;border-left:4px solid ${theme.accent};background:${theme.accentSoft};color:${theme.heading};font-size:15px;line-height:1.8;`,
      ),
    );
  template.content.querySelectorAll<HTMLElement>("blockquote > p:last-child").forEach((element) => {
    element.style.marginBottom = "0";
  });
  template.content
    .querySelectorAll<HTMLElement>("ul,ol")
    .forEach((element) =>
      element.setAttribute("style", `margin:0 0 20px;padding-left:24px;color:${theme.text};font-size:16px;line-height:1.85;`),
    );
  template.content
    .querySelectorAll<HTMLElement>("li")
    .forEach((element) => element.setAttribute("style", "margin:4px 0;padding-left:2px;"));
  template.content
    .querySelectorAll<HTMLElement>("li > p")
    .forEach((element) => element.setAttribute("style", `margin:4px 0;color:${theme.text};font-size:16px;line-height:1.85;`));
  template.content.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((element) => {
    element.disabled = true;
    element.setAttribute("style", `width:16px;height:16px;margin:0 8px 0 0;vertical-align:-2px;accent-color:${theme.accent};`);
  });
  template.content
    .querySelectorAll<HTMLElement>("hr")
    .forEach((element) => element.setAttribute("style", `height:1px;margin:30px 0;border:0;background:${theme.border};`));

  template.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const assetId = image.dataset.assetId;
    if (assetId) {
      const previewUrl = assetUrls[assetId];
      if (previewUrl) image.src = previewUrl;
      else {
        const placeholder = document.createElement("section");
        placeholder.dataset.assetId = assetId;
        placeholder.setAttribute(
          "style",
          `margin:8px 0 24px;padding:18px;border:1px dashed ${theme.border};border-radius:6px;background:${theme.accentSoft};color:${theme.muted};font-size:13px;line-height:1.7;text-align:center;`,
        );
        placeholder.textContent = `图片 ${assetId} 尚未在本机素材库中找到`;
        image.replaceWith(placeholder);
        return;
      }
    }
    image.setAttribute(
      "style",
      `display:block;max-width:100%;height:auto;margin:0 auto;border-radius:6px;border:1px solid ${theme.border};`,
    );
    const parent = image.parentElement;
    if (parent?.tagName === "P" && parent.children.length === 1 && !(parent.textContent ?? "").trim()) {
      const figure = document.createElement("figure");
      figure.setAttribute("style", "margin:8px 0 24px;");
      parent.replaceWith(figure);
      figure.append(image);
      if (image.alt) {
        const caption = document.createElement("figcaption");
        caption.textContent = image.alt;
        caption.setAttribute("style", `margin-top:8px;text-align:center;color:${theme.muted};font-size:13px;line-height:1.6;`);
        figure.append(caption);
      }
    }
  });

  template.content.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.setAttribute("style", "width:100%;min-width:480px;border-collapse:collapse;border-spacing:0;table-layout:auto;");
    table.querySelectorAll<HTMLTableCellElement>("th,td").forEach((cell) => {
      const alignment = cell.getAttribute("align") || "left";
      const header = cell.tagName === "TH";
      cell.setAttribute(
        "style",
        `padding:10px 12px;border:1px solid ${theme.border};background:${header ? theme.accentSoft : "#ffffff"};color:${header ? theme.heading : theme.text};font-size:14px;line-height:${header ? "1.6" : "1.65"};font-weight:${header ? "700" : "400"};text-align:${alignment};vertical-align:${header ? "middle" : "top"};word-break:break-word;`,
      );
    });
    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row, index) => {
      if (index % 2 === 1)
        row.querySelectorAll<HTMLTableCellElement>("td").forEach((cell) => {
          cell.style.background = theme.codeBg;
        });
    });
    const wrapper = document.createElement("section");
    wrapper.setAttribute("style", "margin:8px 0 24px;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;");
    table.replaceWith(wrapper);
    wrapper.append(table);
  });

  return template.innerHTML;
}

function replaceLocalImagesWithIds(bodyHtml: string, theme: Theme) {
  const template = document.createElement("template");
  template.innerHTML = bodyHtml;
  template.content.querySelectorAll<HTMLElement>("[data-asset-id]").forEach((element) => {
    if (!element.isConnected && !template.content.contains(element)) return;
    const id = element.dataset.assetId ?? "未知图片";
    const alt = element instanceof HTMLImageElement ? element.alt : "";
    const placeholder = document.createElement("section");
    placeholder.setAttribute(
      "style",
      `margin:8px 0 24px;padding:16px;border:1px dashed ${theme.border};border-radius:6px;background:${theme.accentSoft};color:${theme.heading};font-size:14px;line-height:1.7;text-align:center;`,
    );
    placeholder.innerHTML = `<strong style="display:block;margin-bottom:4px;">请上传图片：${escapeHtml(id)}</strong><span style="color:${theme.muted};font-size:12px;">${escapeHtml(alt || "无图片说明")}</span>`;
    const figure = element.closest("figure");
    (figure ?? element).replaceWith(placeholder);
  });
  template.content
    .querySelectorAll<HTMLElement>("[data-outline-index]")
    .forEach((element) => element.removeAttribute("data-outline-index"));
  return template.innerHTML;
}

export function buildCopyHtml(bodyHtml: string, theme: Theme) {
  const copyBody = replaceLocalImagesWithIds(bodyHtml, theme);
  return `<div style="max-width:677px;margin:0 auto;padding:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">${copyBody}</div>`;
}

export function buildExportHtml(title: string, bodyHtml: string, theme: Theme) {
  const safeTitle = escapeHtml(title || "未命名文章");
  const exportBody = replaceLocalImagesWithIds(bodyHtml, theme);
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;background:#ffffff;">
  <article style="max-width:677px;margin:0 auto;padding:32px 20px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
    <h1 style="margin:0 0 28px;color:${theme.heading};font-size:28px;line-height:1.35;font-weight:800;">${safeTitle}</h1>
    ${exportBody}
  </article>
</body>
</html>`;
}

export function buildCopyPlainText(markdown: string) {
  return stripMarkdown(
    markdown.replace(localAssetPattern, (_match, alt: string, id: string) => `\n\n【请上传图片：${id}${alt ? `；说明：${alt}` : ""}】\n\n`),
  );
}
