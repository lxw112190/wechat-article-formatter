import DOMPurify from "dompurify";
import { marked } from "marked";
import type { Theme, ThemeHeadingLevel } from "../types";
import { escapeHtml, localAssetPattern, prepareAssetMarkdown } from "./assets";

export function getThemeFontFamily(theme: Theme) {
  const families: Record<Theme["fontFamily"], string> = {
    system: "-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif",
    "microsoft-yahei": "'Microsoft YaHei','微软雅黑','PingFang SC',Arial,sans-serif",
    pingfang: "'PingFang SC','苹方','Microsoft YaHei',Arial,sans-serif",
    "noto-sans": "'Noto Sans SC','Source Han Sans SC','Microsoft YaHei',sans-serif",
    serif: "'Noto Serif SC','Source Han Serif SC','Songti SC',SimSun,serif",
    songti: "'Songti SC','STSong','SimSun','宋体',serif",
    kaiti: "'Kaiti SC','STKaiti','KaiTi','楷体',serif",
    fangsong: "'FangSong','STFangsong','仿宋',serif",
    rounded: "'PingFang SC','Microsoft YaHei UI','Microsoft YaHei',sans-serif",
    arial: "Arial,'Helvetica Neue','Microsoft YaHei',sans-serif",
  };
  return families[theme.fontFamily];
}

function getHeadingStyle(theme: Theme, level: ThemeHeadingLevel) {
  const config = theme.headings[level];
  const levelNumber = Number(level.slice(1));
  const margins: Record<ThemeHeadingLevel, string> = {
    h1: "0 0 22px",
    h2: "34px 0 16px",
    h3: "26px 0 12px",
    h4: "22px 0 10px",
    h5: "20px 0 8px",
    h6: "18px 0 8px",
  };
  const common = `margin:${margins[level]};color:${config.color};font-family:${getThemeFontFamily(theme)};font-size:${config.fontSize}px;line-height:${levelNumber <= 2 ? "1.4" : "1.55"};font-weight:${levelNumber <= 2 ? "800" : "700"};text-align:${config.align};`;
  if (config.decoration === "underline") return `${common}padding:0 0 9px;border-bottom:2px solid ${theme.accent};`;
  if (config.decoration === "filled")
    return `${common}padding:8px 13px;border-radius:${theme.radius}px;background:${theme.accentSoft};border:1px solid ${theme.border};`;
  if (config.decoration === "pill") {
    const position =
      config.align === "center" ? "margin-left:auto;margin-right:auto;" : config.align === "right" ? "margin-left:auto;" : "";
    return `${common}${position}display:table;padding:7px 16px;border-radius:999px;background:${theme.accent};color:#ffffff;`;
  }
  if (config.decoration === "plain") return common;
  return `${common}padding-left:12px;border-left:4px solid ${theme.accent};`;
}

function getBlockquoteStyle(theme: Theme) {
  const common = `margin:8px 0 22px;padding:14px 16px;color:${theme.heading};font-size:15px;line-height:1.8;`;
  if (theme.blockquoteStyle === "card")
    return `${common}border:1px solid ${theme.border};border-radius:${theme.radius}px;background:${theme.accentSoft};`;
  if (theme.blockquoteStyle === "quote")
    return `${common}border-top:1px solid ${theme.border};border-bottom:1px solid ${theme.border};background:transparent;text-align:center;font-style:italic;`;
  return `${common}border-left:4px solid ${theme.accent};background:${theme.accentSoft};`;
}

export function stripMarkdown(value: string) {
  const template = document.createElement("template");
  const withAssetLabels = value.replace(localAssetPattern, (_match, alt: string) => (alt ? `【图片：${alt}】` : "【图片】"));
  template.innerHTML = DOMPurify.sanitize(marked.parse(withAssetLabels, { async: false, gfm: true }));
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

export function renderMarkdown(markdown: string, theme: Theme, assetUrls: Record<string, string> = {}) {
  const fontFamily = getThemeFontFamily(theme);
  const rawHtml = marked.parse(prepareAssetMarkdown(markdown), { async: false, gfm: true, breaks: false });
  const template = document.createElement("template");
  template.innerHTML = DOMPurify.sanitize(rawHtml, { FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"] });

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => element.removeAttribute("style"));
  template.content
    .querySelectorAll<HTMLElement>("p")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `margin:0 0 ${theme.paragraphSpacing}px;color:${theme.text};font-family:${fontFamily};font-size:${theme.bodyFontSize}px;line-height:${theme.bodyLineHeight};letter-spacing:${theme.letterSpacing}px;text-align:${theme.bodyTextAlign};text-indent:${theme.firstLineIndent}em;word-break:break-word;`,
      ),
    );

  const headingStyles: Record<string, string> = {
    H1: getHeadingStyle(theme, "h1"),
    H2: getHeadingStyle(theme, "h2"),
    H3: getHeadingStyle(theme, "h3"),
    H4: getHeadingStyle(theme, "h4"),
    H5: getHeadingStyle(theme, "h5"),
    H6: getHeadingStyle(theme, "h6"),
  };
  template.content.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((element, index) => {
    element.setAttribute("style", headingStyles[element.tagName]);
    element.dataset.outlineIndex = String(index);
  });
  const firstHeading = template.content.querySelector<HTMLElement>("h2");
  if (firstHeading && !firstHeading.previousElementSibling) firstHeading.style.marginTop = "0";

  template.content.querySelectorAll<HTMLElement>("strong").forEach((element) => {
    const style =
      theme.strongStyle === "highlight"
        ? `padding:0 3px;background:${theme.accentSoft};color:${theme.heading};font-weight:700;`
        : theme.strongStyle === "underline"
          ? `color:${theme.heading};font-weight:700;text-decoration:underline;text-decoration-color:${theme.accent};text-decoration-thickness:2px;text-underline-offset:3px;`
          : `color:${theme.heading};font-weight:700;`;
    element.setAttribute("style", style);
  });
  template.content
    .querySelectorAll<HTMLElement>("em")
    .forEach((element) => element.setAttribute("style", `color:${theme.muted};font-style:italic;`));
  template.content
    .querySelectorAll<HTMLElement>("del")
    .forEach((element) =>
      element.setAttribute("style", `color:${theme.muted};text-decoration:line-through;text-decoration-thickness:1.5px;`),
    );
  template.content.querySelectorAll<HTMLElement>("a").forEach((element) => {
    const decoration =
      theme.linkStyle === "underline"
        ? "text-decoration:underline;text-underline-offset:3px;border-bottom:0;"
        : theme.linkStyle === "plain"
          ? "text-decoration:none;border-bottom:0;"
          : `text-decoration:none;border-bottom:1px solid ${theme.border};`;
    element.setAttribute("style", `color:${theme.accent};${decoration}word-break:break-all;`);
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
    const dark = theme.codeStyle === "dark";
    const bordered = theme.codeStyle === "bordered";
    element.setAttribute(
      "style",
      `margin:8px 0 22px;padding:16px;border-radius:${theme.radius}px;background:${dark ? "#1f2937" : bordered ? "#ffffff" : theme.codeBg};border:1px solid ${dark ? "#374151" : theme.border};overflow-x:auto;color:${dark ? "#f8fafc" : theme.heading};font-size:14px;line-height:1.7;white-space:pre;`,
    );
    element
      .querySelector<HTMLElement>("code")
      ?.setAttribute("style", "padding:0;border-radius:0;background:transparent;color:inherit;font:inherit;white-space:pre;");
  });
  template.content
    .querySelectorAll<HTMLElement>("blockquote")
    .forEach((element) => element.setAttribute("style", getBlockquoteStyle(theme)));
  template.content.querySelectorAll<HTMLElement>("blockquote > p").forEach((element) => {
    element.style.textIndent = "0";
    if (!element.nextElementSibling) element.style.marginBottom = "0";
  });
  template.content
    .querySelectorAll<HTMLElement>("ul")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `margin:0 0 20px;padding-left:24px;color:${theme.text};font-size:${theme.bodyFontSize}px;line-height:${theme.bodyLineHeight};list-style-type:${theme.unorderedListStyle};`,
      ),
    );
  template.content
    .querySelectorAll<HTMLElement>("ol")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `margin:0 0 20px;padding-left:28px;color:${theme.text};font-size:${theme.bodyFontSize}px;line-height:${theme.bodyLineHeight};list-style-type:${theme.orderedListStyle};`,
      ),
    );
  template.content
    .querySelectorAll<HTMLElement>("li")
    .forEach((element) => element.setAttribute("style", `margin:${theme.listSpacing}px 0;padding-left:2px;`));
  template.content
    .querySelectorAll<HTMLElement>("li > p")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `margin:4px 0;color:${theme.text};font-size:${theme.bodyFontSize}px;line-height:${theme.bodyLineHeight};`,
      ),
    );
  template.content.querySelectorAll<HTMLElement>("li > p").forEach((element) => {
    element.style.textIndent = "0";
  });
  template.content.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((element) => {
    element.disabled = true;
    element.setAttribute("style", `width:16px;height:16px;margin:0 8px 0 0;vertical-align:-2px;accent-color:${theme.accent};`);
  });
  template.content
    .querySelectorAll<HTMLElement>("hr")
    .forEach((element) =>
      element.setAttribute(
        "style",
        `height:0;margin:30px 0;border:0;border-top:1px ${theme.dividerStyle} ${theme.border};background:transparent;`,
      ),
    );

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
      `display:block;max-width:100%;height:auto;margin:0 auto;border-radius:${theme.imageStyle === "square" ? 0 : theme.radius}px;border:${theme.imageStyle === "shadow" ? "0" : `1px solid ${theme.border}`};box-shadow:${theme.imageStyle === "shadow" ? "0 10px 28px rgba(15,23,42,.16)" : "none"};`,
    );
    const parent = image.parentElement;
    if (parent?.tagName === "P" && parent.children.length === 1 && !(parent.textContent ?? "").trim()) {
      const figure = document.createElement("figure");
      figure.setAttribute("style", `margin:8px 0 ${theme.imageSpacing}px;`);
      parent.replaceWith(figure);
      figure.append(image);
      if (image.alt) {
        const caption = document.createElement("figcaption");
        caption.textContent = image.alt;
        caption.setAttribute(
          "style",
          `margin-top:8px;text-align:${theme.imageCaptionAlign};color:${theme.muted};font-size:${theme.imageCaptionSize}px;line-height:1.6;`,
        );
        figure.append(caption);
      }
    }
  });

  template.content.querySelectorAll<HTMLTableElement>("table").forEach((table) => {
    table.setAttribute("style", "width:100%;min-width:480px;border-collapse:collapse;border-spacing:0;table-layout:auto;");
    table.querySelectorAll<HTMLTableCellElement>("th,td").forEach((cell) => {
      const alignment = cell.getAttribute("align") || "left";
      const header = cell.tagName === "TH";
      const minimal = theme.tableStyle === "minimal";
      const accentHeader = theme.tableStyle === "accent-header" && header;
      cell.setAttribute(
        "style",
        `padding:10px 12px;border:${minimal ? "0" : `1px solid ${theme.border}`};border-bottom:1px solid ${theme.border};background:${accentHeader ? theme.accent : header && !minimal ? theme.accentSoft : "#ffffff"};color:${accentHeader ? "#ffffff" : header ? theme.heading : theme.text};font-size:14px;line-height:${header ? "1.6" : "1.65"};font-weight:${header ? "700" : "400"};text-align:${alignment};vertical-align:${header ? "middle" : "top"};word-break:break-word;`,
      );
    });
    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row, index) => {
      if (index % 2 === 1 && theme.tableStyle !== "minimal")
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
  return `<div style="max-width:677px;margin:0 auto;padding:8px 0 0;font-family:${getThemeFontFamily(theme)};">${copyBody}</div>`;
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
  <article style="max-width:677px;margin:0 auto;padding:32px 20px;font-family:${getThemeFontFamily(theme)};">
    <h1 style="margin:0 0 28px;color:${theme.headings.h1.color};font-size:${theme.headings.h1.fontSize}px;line-height:1.35;font-weight:800;text-align:${theme.headings.h1.align};">${safeTitle}</h1>
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
