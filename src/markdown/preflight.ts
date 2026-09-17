import type { ImageAsset } from "../imageAssets";
import type { OutlineItem, PreflightIssue } from "../types";
import { getLocalAssetReferences } from "./assets";
import { summarizeMarkdownLinks } from "./links";
import { normalizeCodeLanguage } from "./codeLanguages";

export function inspectBeforePublish(
  title: string,
  markdown: string,
  plainText: string,
  outline: OutlineItem[],
  assets: ImageAsset[],
  assetLibraryReady: boolean,
) {
  const issues: PreflightIssue[] = [];
  const trimmedTitle = title.trim();
  if (!trimmedTitle || trimmedTitle === "未命名文章")
    issues.push({ id: "title", label: "文章标题", detail: "请填写明确的文章标题。", status: "error" });
  else if (trimmedTitle.length > 30)
    issues.push({
      id: "title",
      label: "文章标题",
      detail: `当前 ${trimmedTitle.length} 字，建议确认移动端展示是否完整。`,
      status: "warning",
    });
  else issues.push({ id: "title", label: "文章标题", detail: `${trimmedTitle.length} 字，长度适中。`, status: "pass" });

  const characterTotal = plainText.replace(/\s/g, "").length;
  if (!markdown.trim() || characterTotal < 20)
    issues.push({ id: "body", label: "正文内容", detail: "正文为空或内容过少，暂不建议发布。", status: "error" });
  else if (characterTotal < 300)
    issues.push({ id: "body", label: "正文内容", detail: `当前约 ${characterTotal} 字，请确认内容已经完整。`, status: "warning" });
  else issues.push({ id: "body", label: "正文内容", detail: `正文约 ${characterTotal} 字。`, status: "pass" });

  const headingJumps = outline.some((item, index) => index > 0 && item.level > outline[index - 1].level + 1);
  const h1Count = outline.filter((item) => item.level === 1).length;
  if (!outline.length && characterTotal > 500)
    issues.push({ id: "outline", label: "标题结构", detail: "长文没有小标题，建议分节以方便阅读。", status: "warning" });
  else if (headingJumps || h1Count > 1)
    issues.push({
      id: "outline",
      label: "标题结构",
      detail: headingJumps ? "存在标题层级跳跃，例如从二级直接跳到四级。" : "正文中存在多个一级标题，建议只保留一个。",
      status: "warning",
    });
  else
    issues.push({
      id: "outline",
      label: "标题结构",
      detail: outline.length ? `${outline.length} 个标题，层级连续。` : "短文未使用小标题。",
      status: "pass",
    });

  const localReferences = getLocalAssetReferences(markdown);
  const assetIds = new Set(assets.map((asset) => asset.id));
  const missingAssets = localReferences.filter((reference) => !assetIds.has(reference.id));
  if (!assetLibraryReady && localReferences.length)
    issues.push({ id: "images", label: "本地图片", detail: "正在读取图片素材库…", status: "warning" });
  else if (missingAssets.length)
    issues.push({
      id: "images",
      label: "本地图片",
      detail: `${missingAssets.length} 个图片 ID 缺少本机素材：${missingAssets.map((item) => item.id).join("、")}`,
      status: "error",
    });
  else if (localReferences.length)
    issues.push({
      id: "images",
      label: "本地图片",
      detail: `${localReferences.length} 张图片复制时会转为 ID 占位，需在公众号后台上传。`,
      status: "warning",
    });
  else issues.push({ id: "images", label: "本地图片", detail: "没有待手动上传的本地图片。", status: "pass" });

  const imageMatches = [...markdown.matchAll(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g)];
  const missingAlt = imageMatches.filter((match) => !match[1].trim()).length;
  const insecureImages = imageMatches.filter((match) => /^http:\/\//i.test(match[2])).length;
  if (missingAlt || insecureImages)
    issues.push({
      id: "image-meta",
      label: "图片说明",
      detail: `${missingAlt ? `${missingAlt} 张图片缺少说明` : ""}${missingAlt && insecureImages ? "；" : ""}${insecureImages ? `${insecureImages} 张图片使用 HTTP 地址` : ""}。`,
      status: "warning",
    });
  else
    issues.push({
      id: "image-meta",
      label: "图片说明",
      detail: imageMatches.length ? "图片均有说明，地址协议正常。" : "正文没有图片。",
      status: "pass",
    });

  const markdownWithoutImages = markdown.replace(/!\[[^\]]*\]\([^)]*\)/g, "");
  const linkMatches = [...markdownWithoutImages.matchAll(/\[([^\]]*)\]\(([^)]*)\)/g)];
  const linkSummary = summarizeMarkdownLinks(markdownWithoutImages);
  const exampleLinks = linkMatches.filter((match) => /example\.com|图片地址/i.test(match[2])).length;
  if (linkSummary.emptyCount)
    issues.push({ id: "links", label: "正文链接", detail: `${linkSummary.emptyCount} 个链接缺少地址。`, status: "error" });
  else if (linkSummary.insecureHttpCount || linkSummary.externalHttpsCount || linkSummary.mailtoCount || exampleLinks)
    issues.push({
      id: "links",
      label: "正文链接",
      detail: `${linkSummary.wechatArticleCount ? `${linkSummary.wechatArticleCount} 个公众号文章链接，可由微信保留跳转` : ""}${linkSummary.wechatArticleCount && (linkSummary.externalHttpsCount || linkSummary.insecureHttpCount || linkSummary.mailtoCount) ? "；" : ""}${linkSummary.externalHttpsCount ? `${linkSummary.externalHttpsCount} 个普通外部 HTTPS 链接，复制时会保留 URL` : ""}${linkSummary.insecureHttpCount ? `${linkSummary.externalHttpsCount ? "；" : ""}${linkSummary.insecureHttpCount} 个 HTTP 链接，请确认安全性` : ""}${linkSummary.mailtoCount ? `${linkSummary.externalHttpsCount || linkSummary.insecureHttpCount ? "；" : ""}${linkSummary.mailtoCount} 个邮箱链接，复制时会保留邮箱地址` : ""}${exampleLinks ? `${linkSummary.externalHttpsCount || linkSummary.insecureHttpCount || linkSummary.mailtoCount ? "；" : ""}${exampleLinks} 个示例链接未替换` : ""}。`,
      status: "warning",
    });
  else
    issues.push({
      id: "links",
      label: "正文链接",
      detail: "正文没有需要处理的外部链接。",
      status: "pass",
    });

  const placeholderTerms = ["开始写作...", "图片需重新上传", "待补充", "TODO", "TBD", "https://example.com"];
  const foundTerms = placeholderTerms.filter((term) => markdown.toLowerCase().includes(term.toLowerCase()));
  if (foundTerms.length)
    issues.push({ id: "placeholders", label: "占位内容", detail: `发现可能未完成的内容：${foundTerms.join("、")}`, status: "warning" });
  else issues.push({ id: "placeholders", label: "占位内容", detail: "未发现常见草稿占位词。", status: "pass" });

  const tableCount = (markdown.match(/^\s*\|.+\|\s*$/gm) ?? []).length ? (markdown.match(/^\s*\|?\s*:?-{3,}/gm) ?? []).length : 0;
  const hasRawHtml = /<(?:details|summary|div|section|table|video|audio|iframe)\b/i.test(markdown);
  if (tableCount || hasRawHtml)
    issues.push({
      id: "compatibility",
      label: "移动端兼容",
      detail: `${tableCount ? `含 ${tableCount} 个表格，请检查窄屏展示` : ""}${tableCount && hasRawHtml ? "；" : ""}${hasRawHtml ? "含 HTML 内容，请在公众号后台复查样式" : ""}。`,
      status: "warning",
    });
  else issues.push({ id: "compatibility", label: "移动端兼容", detail: "未发现表格或复杂 HTML 内容。", status: "pass" });

  const codeBlocks = [...markdown.matchAll(/^\s*(`{3,}|~{3,})\s*([^\r\n]*)\r?\n/gm)];
  const unspecifiedCode = codeBlocks.filter(
    (match) => !normalizeCodeLanguage(match[2]) || normalizeCodeLanguage(match[2]) === "text",
  ).length;
  const boundaryWhitespace = codeBlocks.filter((match) => {
    const contentStart = (match.index ?? 0) + match[0].length;
    const close = markdown.slice(contentStart).search(new RegExp(`\\n\\s*${match[1]}\\s*(?:\\r?\\n|$)`));
    if (close < 0) return false;
    const content = markdown.slice(contentStart, contentStart + close);
    return /^\n|\n$/.test(content);
  }).length;
  if (unspecifiedCode || boundaryWhitespace)
    issues.push({
      id: "code",
      label: "代码块",
      detail: `${unspecifiedCode ? `${unspecifiedCode} 个代码块未指定语言` : ""}${unspecifiedCode && boundaryWhitespace ? "；" : ""}${boundaryWhitespace ? `${boundaryWhitespace} 个代码块首尾有多余空行` : ""}。`,
      status: "warning",
    });
  else
    issues.push({
      id: "code",
      label: "代码块",
      detail: codeBlocks.length ? `已检查 ${codeBlocks.length} 个代码块。` : "正文没有代码块。",
      status: "pass",
    });

  return issues;
}
