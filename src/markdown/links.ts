export type LinkKind = "wechat-article" | "external-http" | "mailto" | "other";

export type LinkSummary = {
  wechatArticleCount: number;
  externalHttpsCount: number;
  insecureHttpCount: number;
  mailtoCount: number;
  emptyCount: number;
};

export function isWechatArticleUrl(href: string) {
  try {
    const url = new URL(href.trim());
    return (
      url.protocol === "https:" &&
      url.hostname.toLowerCase() === "mp.weixin.qq.com" &&
      (url.pathname === "/s" || url.pathname.startsWith("/s/"))
    );
  } catch {
    return false;
  }
}

export function classifyLink(href: string): LinkKind {
  const value = href.trim();
  if (isWechatArticleUrl(value)) return "wechat-article";
  if (/^mailto:/i.test(value)) return "mailto";
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") return "external-http";
  } catch {
    return "other";
  }
  return "other";
}

export function normalizeLinkText(value: string) {
  return value.trim().replace(/\/$/, "");
}

export function formatLinkAsPlainText(text: string, href: string) {
  const label = text.trim();
  const target = href.trim().replace(/^mailto:/i, "");
  if (!target) return label;
  if (!label) return target;
  if (normalizeLinkText(label) === normalizeLinkText(target)) return label;
  return `${label}（${target}）`;
}

export function replaceMarkdownLinksWithPlainText(markdown: string) {
  return markdown
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (_match, alt: string) => (alt ? `【图片：${alt}】` : "【图片】"))
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+[^)]*)?\)/g, (_match, text: string, href: string) => formatLinkAsPlainText(text, href))
    .replace(/<((?:https?:\/\/|mailto:)[^>]+)>/gi, (_match, href: string) => href.replace(/^mailto:/i, ""))
    .replace(
      /^(\s*[-*+]\s+)\[([ xX])\]\s+/gm,
      (_match, prefix: string, checked: string) => `${prefix}${checked.trim().toLowerCase() === "x" ? "☑" : "☐"} `,
    );
}

export function summarizeMarkdownLinks(markdown: string): LinkSummary {
  const summary: LinkSummary = { wechatArticleCount: 0, externalHttpsCount: 0, insecureHttpCount: 0, mailtoCount: 0, emptyCount: 0 };
  const masked = markdown.replace(/!?(\[[^\]]*\])\(([^)]*)\)/g, (_match, _label: string, target: string) => {
    const href = target.trim().split(/\s+/)[0] ?? "";
    if (!href) {
      summary.emptyCount += 1;
      return "";
    }
    const kind = classifyLink(href);
    if (kind === "wechat-article") summary.wechatArticleCount += 1;
    else if (kind === "mailto") summary.mailtoCount += 1;
    else if (/^https:\/\//i.test(href)) summary.externalHttpsCount += 1;
    else if (/^http:\/\//i.test(href)) summary.insecureHttpCount += 1;
    return " ".repeat(_match.length);
  });
  const candidates = [...masked.matchAll(/<((?:https?:\/\/|mailto:)[^>]+)>|(?<![\w"'=])(https?:\/\/[^\s<>)]+)/gi)];
  candidates.forEach((match) => {
    const href = (match[1] || match[2] || "").trim();
    const kind = classifyLink(href);
    if (kind === "wechat-article") summary.wechatArticleCount += 1;
    else if (kind === "mailto") summary.mailtoCount += 1;
    else if (/^https:\/\//i.test(href)) summary.externalHttpsCount += 1;
    else if (/^http:\/\//i.test(href)) summary.insecureHttpCount += 1;
  });
  return summary;
}
