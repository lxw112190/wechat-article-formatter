export type PasteContentType = "markdown" | "word" | "rich-html" | "plain-text";

export type PasteDetectionResult = {
  type: PasteContentType;
  markdownScore: number;
  reason: string;
};

export function normalizePasteText(value: string) {
  return value
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function extractHtmlText(html: string) {
  const container = document.createElement("div");
  container.innerHTML = html;
  return container.textContent ?? "";
}

export function htmlTextMatchesPlainText(plainText: string, html: string) {
  if (!html.trim()) return false;
  return normalizePasteText(plainText) === normalizePasteText(extractHtmlText(html));
}

export function isWordHtml(html: string) {
  return Boolean(html.trim() && /Mso|mso-|urn:schemas-microsoft-com:office|<o:/i.test(html));
}

export function getMarkdownScore(text: string) {
  if (!text.trim()) return 0;
  let score = 0;
  if (/^#{1,6}\s+\S+/m.test(text)) score += 2;
  if (/(?:^|\n)```[\w+-]*\s*\n[\s\S]*?\n```(?:\n|$)/.test(text)) score += 3;
  if (/!\[[^\]]*\]\([^)]+\)/.test(text)) score += 3;
  if (/\[[^\]]+\]\([^)]+\)/.test(text)) score += 2;
  if (/^\s*[-*+]\s+\[[ xX]\]\s+\S+/m.test(text)) score += 3;
  if (/^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*:?-{3,}:?\s*\|?\s*$/m.test(text)) score += 3;
  if (/^>\s+\S+/m.test(text)) score += 1;
  if (/^\s*[-*+]\s+\S+/m.test(text)) score += 1;
  if (/^\s*\d+\.\s+\S+/m.test(text)) score += 1;
  if (/\*\*[^*\n]+\*\*/.test(text)) score += 1;
  if (/(?<!`)`[^`\n]+`(?!`)/.test(text)) score += 1;
  if (/~~[^~\n]+~~/.test(text)) score += 1;
  return score;
}

export function hasRichHtmlSemantics(html: string) {
  if (!html.trim()) return false;
  const container = document.createElement("div");
  container.innerHTML = html;
  return Boolean(container.querySelector("h1,h2,h3,h4,h5,h6,strong,b,em,i,del,s,blockquote,ul,ol,li,table,a[href],img"));
}

export function detectPasteContent(plainText: string, html: string): PasteDetectionResult {
  const plain = plainText.trim();
  const rich = html.trim();
  const markdownScore = getMarkdownScore(plainText);
  if (!rich) return { type: "plain-text", markdownScore, reason: "no-html" };
  if (isWordHtml(html)) return { type: "word", markdownScore: 0, reason: "word-html" };
  if (markdownScore >= 2 && htmlTextMatchesPlainText(plainText, html)) {
    return { type: "markdown", markdownScore, reason: "markdown-source-with-html-wrapper" };
  }
  if (markdownScore >= 4) return { type: "markdown", markdownScore, reason: "strong-markdown-signals" };
  if (hasRichHtmlSemantics(html)) return { type: "rich-html", markdownScore, reason: "rich-html-semantics" };
  return { type: "plain-text", markdownScore, reason: plain ? "plain-text-with-html-wrapper" : "empty-text" };
}
