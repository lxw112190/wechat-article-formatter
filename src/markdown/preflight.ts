import type { ImageAsset } from "../imageAssets";
import type { OutlineItem, PreflightIssue } from "../types";
import { getLocalAssetReferences } from "./assets";

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
  const emptyLinks = linkMatches.filter((match) => !match[2].trim()).length;
  const insecureLinks = linkMatches.filter((match) => /^http:\/\//i.test(match[2].trim())).length;
  const exampleLinks = linkMatches.filter((match) => /example\.com|图片地址/i.test(match[2])).length;
  if (emptyLinks) issues.push({ id: "links", label: "正文链接", detail: `${emptyLinks} 个链接缺少地址。`, status: "error" });
  else if (insecureLinks || exampleLinks)
    issues.push({
      id: "links",
      label: "正文链接",
      detail: `${insecureLinks ? `${insecureLinks} 个 HTTP 链接` : ""}${insecureLinks && exampleLinks ? "；" : ""}${exampleLinks ? `${exampleLinks} 个示例链接未替换` : ""}。`,
      status: "warning",
    });
  else
    issues.push({
      id: "links",
      label: "正文链接",
      detail: linkMatches.length ? `${linkMatches.length} 个链接已完成基础检查。` : "正文没有外部链接。",
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

  return issues;
}
