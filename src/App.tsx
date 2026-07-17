import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent as ReactClipboardEvent, CSSProperties } from "react";
import DOMPurify from "dompurify";
import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

type Theme = {
  id: string;
  name: string;
  accent: string;
  accentSoft: string;
  heading: string;
  text: string;
  muted: string;
  border: string;
  codeBg: string;
};

type Article = {
  id: string;
  title: string;
  markdown: string;
  updatedAt: string;
};

type ArticleVersion = {
  id: string;
  articleId: string;
  title: string;
  markdown: string;
  savedAt: string;
};

const themes: Theme[] = [
  { id: "wechat", name: "青绿", accent: "#12b76a", accentSoft: "#e8fbf2", heading: "#0f5132", text: "#1f2937", muted: "#667085", border: "#b7ebd1", codeBg: "#f1fbf6" },
  { id: "ink", name: "墨蓝", accent: "#2563eb", accentSoft: "#eef4ff", heading: "#172554", text: "#1e293b", muted: "#64748b", border: "#bfdbfe", codeBg: "#f5f7fb" },
  { id: "warm", name: "暖橙", accent: "#d97706", accentSoft: "#fff7ed", heading: "#7c2d12", text: "#2f2a24", muted: "#756b61", border: "#fed7aa", codeBg: "#fffaf2" },
  { id: "rose", name: "酒红", accent: "#be123c", accentSoft: "#fff1f2", heading: "#881337", text: "#33272b", muted: "#7f6670", border: "#fecdd3", codeBg: "#fff7f8" },
  { id: "violet", name: "紫灰", accent: "#7c3aed", accentSoft: "#f5f3ff", heading: "#4c1d95", text: "#292334", muted: "#746b83", border: "#ddd6fe", codeBg: "#faf8ff" },
  { id: "slate", name: "极简灰", accent: "#475569", accentSoft: "#f1f5f9", heading: "#1e293b", text: "#334155", muted: "#64748b", border: "#cbd5e1", codeBg: "#f8fafc" },
  { id: "teal", name: "湖蓝", accent: "#0f766e", accentSoft: "#f0fdfa", heading: "#134e4a", text: "#243534", muted: "#617370", border: "#99f6e4", codeBg: "#f4fffd" },
];

const starterMarkdown = `# 一篇公众号文章，从草稿到可发布

## 先把读者放在第一位
公众号的开头不需要铺太长。用一句具体判断接住读者，再给出这篇文章要解决的问题。

> 好的排版不是装饰，而是降低阅读阻力。

## 用结构替代堆句子
- 每一节只承载一个观点
- 小标题要能被单独扫读
- 重点句可以加粗，但不要每段都加粗

## 发布前检查三件事
1. 标题是否足够明确
2. 摘要是否像一个自然的人写出来
3. 正文是否讲清楚一件事

### 可直接粘贴的素材

\`\`\`
把这段 HTML 复制到公众号后台，正文样式会尽量保留。
\`\`\`

最后，给文章留一个清晰的收束：读者读完之后，应该知道下一步做什么。`;

const initialArticles: Article[] = [
  {
    id: "starter",
    title: "一篇公众号文章，从草稿到可发布",
    markdown: starterMarkdown,
    updatedAt: "刚刚",
  },
  {
    id: "writing",
    title: "写作，是一次对读者时间的尊重",
    markdown: "# 写作，是一次对读者时间的尊重\n\n## 先说结论\n一篇好文章不是写得多，而是让读者更快理解。",
    updatedAt: "昨天",
  },
  {
    id: "review",
    title: "六月内容复盘",
    markdown: "# 六月内容复盘\n\n## 有效的选题\n从具体问题出发，往往比泛泛而谈更容易被读完。",
    updatedAt: "6 月 30 日",
  },
];

const articleStorageKey = "wechat-publisher-articles";
const historyStorageKey = "wechat-publisher-history";
const maxVersionsPerArticle = 30;

function getSavedArticles() {
  try {
    const saved = window.localStorage.getItem(articleStorageKey);
    const parsed = saved ? JSON.parse(saved) : null;
    return Array.isArray(parsed) && parsed.length ? parsed as Article[] : initialArticles;
  } catch {
    return initialArticles;
  }
}

function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function getSavedHistory() {
  try {
    const saved = window.localStorage.getItem(historyStorageKey);
    const parsed = saved ? JSON.parse(saved) : null;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is ArticleVersion => item && typeof item === "object" && typeof item.id === "string" && typeof item.articleId === "string" && typeof item.title === "string" && typeof item.markdown === "string" && typeof item.savedAt === "string");
  } catch {
    return [];
  }
}

function stripMarkdown(value: string) {
  const template = document.createElement("template");
  template.innerHTML = DOMPurify.sanitize(marked.parse(value, { async: false, gfm: true }));
  return (template.content.textContent ?? "").replace(/\s+/g, " ").trim();
}

function renderMarkdown(markdown: string, theme: Theme) {
  const rawHtml = marked.parse(markdown, { async: false, gfm: true, breaks: false });
  const template = document.createElement("template");
  template.innerHTML = DOMPurify.sanitize(rawHtml, { FORBID_TAGS: ["script", "style", "iframe", "object", "embed", "form"] });

  template.content.querySelectorAll<HTMLElement>("[style]").forEach((element) => element.removeAttribute("style"));
  template.content.querySelectorAll<HTMLElement>("p").forEach((element) => element.setAttribute("style", `margin:0 0 18px;color:${theme.text};font-size:16px;line-height:1.85;letter-spacing:0;word-break:break-word;`));

  const headingStyles: Record<string, string> = {
    H1: `margin:0 0 22px;color:${theme.heading};font-size:24px;line-height:1.35;font-weight:800;`,
    H2: `margin:34px 0 16px;padding-left:12px;border-left:4px solid ${theme.accent};color:${theme.heading};font-size:20px;line-height:1.45;font-weight:750;`,
    H3: `margin:26px 0 12px;color:${theme.heading};font-size:17px;line-height:1.5;font-weight:700;`,
    H4: `margin:22px 0 10px;color:${theme.heading};font-size:16px;line-height:1.55;font-weight:700;`,
    H5: `margin:20px 0 8px;color:${theme.heading};font-size:15px;line-height:1.6;font-weight:700;`,
    H6: `margin:18px 0 8px;color:${theme.muted};font-size:14px;line-height:1.6;font-weight:700;`,
  };
  template.content.querySelectorAll<HTMLElement>("h1,h2,h3,h4,h5,h6").forEach((element) => element.setAttribute("style", headingStyles[element.tagName]));
  const firstHeading = template.content.querySelector<HTMLElement>("h2");
  if (firstHeading && !firstHeading.previousElementSibling) firstHeading.style.marginTop = "0";

  template.content.querySelectorAll<HTMLElement>("strong").forEach((element) => element.setAttribute("style", `color:${theme.heading};font-weight:700;`));
  template.content.querySelectorAll<HTMLElement>("em").forEach((element) => element.setAttribute("style", `color:${theme.muted};font-style:italic;`));
  template.content.querySelectorAll<HTMLElement>("del").forEach((element) => element.setAttribute("style", `color:${theme.muted};text-decoration:line-through;text-decoration-thickness:1.5px;`));
  template.content.querySelectorAll<HTMLElement>("a").forEach((element) => {
    element.setAttribute("style", `color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.border};word-break:break-all;`);
    element.setAttribute("rel", "noopener noreferrer");
  });
  template.content.querySelectorAll<HTMLElement>("code").forEach((element) => element.setAttribute("style", `padding:2px 6px;border-radius:4px;background:${theme.codeBg};color:${theme.heading};font-family:SFMono-Regular,Consolas,Liberation Mono,Courier New,monospace;font-size:90%;word-break:break-word;`));
  template.content.querySelectorAll<HTMLElement>("pre").forEach((element) => {
    element.setAttribute("style", `margin:8px 0 22px;padding:16px;border-radius:6px;background:${theme.codeBg};border:1px solid ${theme.border};overflow-x:auto;color:${theme.heading};font-size:14px;line-height:1.7;white-space:pre;`);
    element.querySelector<HTMLElement>("code")?.setAttribute("style", "padding:0;border-radius:0;background:transparent;color:inherit;font:inherit;white-space:pre;");
  });
  template.content.querySelectorAll<HTMLElement>("blockquote").forEach((element) => element.setAttribute("style", `margin:8px 0 22px;padding:14px 16px;border-left:4px solid ${theme.accent};background:${theme.accentSoft};color:${theme.heading};font-size:15px;line-height:1.8;`));
  template.content.querySelectorAll<HTMLElement>("blockquote > p:last-child").forEach((element) => element.style.marginBottom = "0");
  template.content.querySelectorAll<HTMLElement>("ul,ol").forEach((element) => element.setAttribute("style", `margin:0 0 20px;padding-left:24px;color:${theme.text};font-size:16px;line-height:1.85;`));
  template.content.querySelectorAll<HTMLElement>("li").forEach((element) => element.setAttribute("style", "margin:4px 0;padding-left:2px;"));
  template.content.querySelectorAll<HTMLElement>("li > p").forEach((element) => element.setAttribute("style", `margin:4px 0;color:${theme.text};font-size:16px;line-height:1.85;`));
  template.content.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((element) => {
    element.disabled = true;
    element.setAttribute("style", `width:16px;height:16px;margin:0 8px 0 0;vertical-align:-2px;accent-color:${theme.accent};`);
  });
  template.content.querySelectorAll<HTMLElement>("hr").forEach((element) => element.setAttribute("style", `height:1px;margin:30px 0;border:0;background:${theme.border};`));

  template.content.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    image.setAttribute("style", `display:block;max-width:100%;height:auto;margin:0 auto;border-radius:6px;border:1px solid ${theme.border};`);
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
      cell.setAttribute("style", `padding:10px 12px;border:1px solid ${theme.border};background:${header ? theme.accentSoft : "#ffffff"};color:${header ? theme.heading : theme.text};font-size:14px;line-height:${header ? "1.6" : "1.65"};font-weight:${header ? "700" : "400"};text-align:${alignment};vertical-align:${header ? "middle" : "top"};word-break:break-word;`);
    });
    table.querySelectorAll<HTMLTableRowElement>("tbody tr").forEach((row, index) => {
      if (index % 2 === 1) row.querySelectorAll<HTMLTableCellElement>("td").forEach((cell) => { cell.style.background = theme.codeBg; });
    });
    const wrapper = document.createElement("section");
    wrapper.setAttribute("style", "margin:8px 0 24px;max-width:100%;overflow-x:auto;-webkit-overflow-scrolling:touch;");
    table.replaceWith(wrapper);
    wrapper.append(table);
  });

  return template.innerHTML;
}

function buildCopyHtml(bodyHtml: string) {
  return `<div style="max-width:677px;margin:0 auto;padding:8px 0 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">${bodyHtml}</div>`;
}

function buildExportHtml(title: string, bodyHtml: string, theme: Theme) {
  const safeTitle = escapeHtml(title || "未命名文章");
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
    ${bodyHtml}
  </article>
</body>
</html>`;
}

function formatUpdatedAt(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return "刚刚";
  if (minutes < 60) return `${minutes} 分钟前`;
  if (minutes < 1_440) return `${Math.floor(minutes / 60)} 小时前`;
  return new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric" }).format(timestamp);
}

function formatVersionTime(value: string) {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(timestamp);
}

function getMarkdownTitle(markdown: string, filename: string) {
  const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
  const fileTitle = filename.replace(/\.(md|markdown)$/i, "").trim();
  return heading || fileTitle || "导入的文章";
}

function getMarkdownFilename(title: string) {
  const safeName = title.trim().replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").replace(/[. ]+$/g, "").slice(0, 80);
  return `${safeName || "未命名文章"}.md`;
}

const pasteTurndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});
pasteTurndownService.use(gfm);
pasteTurndownService.keep(["details", "summary", "sub", "sup"]);

const listMarkerPattern = /^\s*(?:(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)、]|[•·▪◦‣⁃o])\s*/;

function stripLeadingListMarker(element: HTMLElement) {
  const nodes: Node[] = [...element.childNodes];
  while (nodes.length) {
    const node = nodes.shift();
    if (!node) continue;
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      node.textContent = node.textContent.replace(listMarkerPattern, "");
      return;
    }
    nodes.unshift(...node.childNodes);
  }
}

function normalizeOfficeLists(root: HTMLElement) {
  const parents = [root, ...root.querySelectorAll<HTMLElement>("*")];
  parents.forEach((parent) => {
    let activeList: HTMLOListElement | HTMLUListElement | null = null;
    let activeType = "";
    [...parent.children].forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      const style = child.getAttribute("style") ?? "";
      const isOfficeList = /MsoListParagraph/i.test(child.className) || /mso-list/i.test(style);
      if (!isOfficeList) {
        activeList = null;
        activeType = "";
        return;
      }

      const ignoredMarkers = [...child.querySelectorAll<HTMLElement>("span")].filter((span) => /mso-list\s*:\s*Ignore/i.test(span.getAttribute("style") ?? ""));
      const markerText = ignoredMarkers.map((span) => span.textContent ?? "").join("") || child.textContent || "";
      const marker = markerText.match(listMarkerPattern);
      const ordered = Boolean(marker?.[1]);
      const type = ordered ? "OL" : "UL";
      if (!activeList || activeType !== type) {
        activeList = document.createElement(ordered ? "ol" : "ul");
        activeType = type;
        if (ordered && marker?.[1] && /^\d+$/.test(marker[1])) (activeList as HTMLOListElement).start = Number(marker[1]);
        parent.insertBefore(activeList, child);
      }

      ignoredMarkers.forEach((span) => span.remove());
      const item = document.createElement("li");
      while (child.firstChild) item.append(child.firstChild);
      if (!ignoredMarkers.length) stripLeadingListMarker(item);
      activeList.append(item);
      child.remove();
    });
  });
}

function convertPastedHtml(html: string) {
  const source = /Mso|mso-|urn:schemas-microsoft-com:office|<o:/i.test(html) ? "Word" : "网页";
  const sanitized = DOMPurify.sanitize(html, { FORBID_TAGS: ["script", "style", "noscript", "iframe", "object", "embed", "form", "button"] });
  const container = document.createElement("div");
  container.innerHTML = sanitized;

  container.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const style = (element.getAttribute("style") ?? "").toLowerCase();
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(style)) {
      element.remove();
      return;
    }
    if (element.tagName !== "SPAN") return;
    const wrappers: Array<"strong" | "em" | "del"> = [];
    if (/font-weight\s*:\s*(?:bold|[6-9]00)/.test(style)) wrappers.push("strong");
    if (/font-style\s*:\s*italic/.test(style)) wrappers.push("em");
    if (/text-decoration[^;]*line-through/.test(style)) wrappers.push("del");
    wrappers.forEach((tag) => {
      const wrapper = document.createElement(tag);
      while (element.firstChild) wrapper.append(element.firstChild);
      element.append(wrapper);
    });
  });

  normalizeOfficeLists(container);

  let skippedImages = 0;
  container.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const sourceUrl = (image.getAttribute("src") ?? "").trim();
    if (sourceUrl && !/^(?:file|blob|cid|data):/i.test(sourceUrl)) return;
    const placeholder = document.createElement("span");
    placeholder.textContent = `【图片需重新上传${image.alt ? `：${image.alt}` : ""}】`;
    image.replaceWith(placeholder);
    skippedImages += 1;
  });

  container.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const allowed = new Set<string>();
    if (element.tagName === "A") ["href", "title"].forEach((name) => allowed.add(name));
    if (element.tagName === "IMG") ["src", "alt", "title"].forEach((name) => allowed.add(name));
    if (element.tagName === "TD" || element.tagName === "TH") ["align", "colspan", "rowspan"].forEach((name) => allowed.add(name));
    if (element.tagName === "OL") allowed.add("start");
    if (element.tagName === "INPUT") ["type", "checked", "disabled"].forEach((name) => allowed.add(name));
    if (element.tagName === "PRE" || element.tagName === "CODE") allowed.add("class");
    if (element.tagName === "DETAILS") allowed.add("open");
    element.getAttributeNames().forEach((name) => { if (!allowed.has(name)) element.removeAttribute(name); });
  });

  container.querySelectorAll("span").forEach((span) => span.replaceWith(...span.childNodes));
  const markdown = pasteTurndownService.turndown(container).replace(/\n{3,}/g, "\n\n").trim();
  return { markdown, skippedImages, source };
}

const formatGroups = [
  { label: "文字", actions: [["bold", "加粗"], ["italic", "斜体"], ["strike", "删除线"], ["inlineCode", "行内代码"], ["link", "链接"]] },
  { label: "标题", actions: [["h1", "一级标题"], ["h2", "二级标题"], ["h3", "三级标题"], ["h4", "四级标题"], ["h5", "五级标题"], ["h6", "六级标题"]] },
  { label: "内容块", actions: [["quote", "引用"], ["list", "无序列表"], ["ordered", "有序列表"], ["task", "任务列表"], ["codeBlock", "代码块"], ["table", "表格"], ["image", "图片"], ["hr", "分隔线"], ["hardBreak", "强制换行"], ["htmlBlock", "HTML 块"]] },
] as const;

export default function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const markdownFileInputRef = useRef<HTMLInputElement>(null);
  const syncTargetRef = useRef<HTMLElement | null>(null);
  const autoSaveTimerRef = useRef<number | null>(null);
  const pasteNoticeTimerRef = useRef<number | null>(null);
  const [articles, setArticles] = useState(getSavedArticles);
  const [history, setHistory] = useState<ArticleVersion[]>(getSavedHistory);
  const [activeId, setActiveId] = useState(() => getSavedArticles()[0].id);
  const [markdown, setMarkdown] = useState(() => getSavedArticles()[0].markdown);
  const [title, setTitle] = useState(() => getSavedArticles()[0].title);
  const [themeId, setThemeId] = useState(themes[0].id);
  const [copied, setCopied] = useState("复制正文");
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState("立即保存");
  const [storageError, setStorageError] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [markdownMessage, setMarkdownMessage] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [formatOpen, setFormatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [syncScroll, setSyncScroll] = useState(() => window.localStorage.getItem("wechat-sync-scroll") !== "false");

  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  const bodyHtml = useMemo(() => renderMarkdown(markdown, theme), [markdown, theme]);
  const copyHtml = useMemo(() => buildCopyHtml(bodyHtml), [bodyHtml]);
  const articlePlainText = useMemo(() => stripMarkdown(markdown), [markdown]);
  const copyPlainText = useMemo(() => articlePlainText, [articlePlainText]);
  const characterCount = articlePlainText.replace(/\s/g, "").length;
  const imageCount = (markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const headingCount = (markdown.match(/^#{1,6}\s+/gm) ?? []).length;
  const readMinutes = Math.max(1, Math.ceil(characterCount / 450));
  const activeArticle = articles.find((article) => article.id === activeId);
  const isDirty = Boolean(activeArticle && (activeArticle.title !== title || activeArticle.markdown !== markdown));
  const hasUnsavedChanges = isDirty || storageError;
  const currentHistory = history.filter((version) => version.articleId === activeId).sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  const themeVars = { "--article-accent": theme.accent, "--article-soft": theme.accentSoft, "--article-heading": theme.heading } as CSSProperties;

  useEffect(() => {
    try {
      window.localStorage.setItem(articleStorageKey, JSON.stringify(articles));
      setStorageError(false);
    } catch {
      setStorageError(true);
      setSaved("本地存储空间不足");
    }
  }, [articles]);

  useEffect(() => {
    try {
      window.localStorage.setItem(historyStorageKey, JSON.stringify(history));
    } catch {
      setSaved("历史记录存储失败");
    }
  }, [history]);

  useEffect(() => {
    if (!activeId || !isDirty) return;
    setSaved("自动保存中…");
    if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = window.setTimeout(() => {
      autoSaveTimerRef.current = null;
      persistCurrentArticle("自动保存");
    }, 900);
    return () => {
      if (autoSaveTimerRef.current) window.clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    };
  }, [activeId, title, markdown]);

  useEffect(() => {
    if (!hasUnsavedChanges) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    window.localStorage.setItem("wechat-sync-scroll", String(syncScroll));
    if (syncScroll) requestAnimationFrame(() => syncScrollPosition(textareaRef.current, previewRef.current));
  }, [syncScroll]);

  useEffect(() => () => {
    if (pasteNoticeTimerRef.current) window.clearTimeout(pasteNoticeTimerRef.current);
  }, []);

  function syncScrollPosition(source: HTMLElement | null, target: HTMLElement | null) {
    if (!syncScroll || !source || !target || syncTargetRef.current === source) return;
    const sourceRange = source.scrollHeight - source.clientHeight;
    const targetRange = target.scrollHeight - target.clientHeight;
    const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
    syncTargetRef.current = target;
    target.scrollTop = progress * Math.max(0, targetRange);
    requestAnimationFrame(() => {
      if (syncTargetRef.current === target) syncTargetRef.current = null;
    });
  }

  function insertMarkdown(before: string, after = "", fallback = "重点内容") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.slice(start, end) || fallback;
    setMarkdown(`${markdown.slice(0, start)}${before}${selected}${after}${markdown.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    });
  }

  function insertBlock(content: string) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const before = start > 0 && markdown[start - 1] !== "\n" ? "\n\n" : "";
    const after = end < markdown.length && markdown[end] !== "\n" ? "\n\n" : "";
    const replacement = `${before}${content}${after}`;
    setMarkdown(`${markdown.slice(0, start)}${replacement}${markdown.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + replacement.length - after.length;
    });
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    if (!html.trim()) return;
    const converted = convertPastedHtml(html);
    const content = converted.markdown || event.clipboardData.getData("text/plain");
    if (!content) return;

    event.preventDefault();
    const textarea = event.currentTarget;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const multiline = content.includes("\n");
    const leading = multiline && start > 0 && markdown[start - 1] !== "\n" ? "\n\n" : "";
    const trailing = multiline && end < markdown.length && markdown[end] !== "\n" ? "\n\n" : "";
    const insertion = `${leading}${content}${trailing}`;
    setMarkdown(`${markdown.slice(0, start)}${insertion}${markdown.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = start + insertion.length - trailing.length;
    });

    if (pasteNoticeTimerRef.current) window.clearTimeout(pasteNoticeTimerRef.current);
    setPasteMessage(`已清理${converted.source}格式并转换为 Markdown${converted.skippedImages ? `；${converted.skippedImages} 张本地图片需重新上传` : ""}`);
    pasteNoticeTimerRef.current = window.setTimeout(() => {
      setPasteMessage("");
      pasteNoticeTimerRef.current = null;
    }, 3600);
  }

  function applyFormat(value: string) {
    const actions: Record<string, () => void> = {
      bold: () => insertMarkdown("**", "**"),
      italic: () => insertMarkdown("*", "*"),
      strike: () => insertMarkdown("~~", "~~"),
      h1: () => insertMarkdown("# ", "", "一级标题"),
      h2: () => insertMarkdown("## ", "", "二级标题"),
      h3: () => insertMarkdown("### ", "", "三级标题"),
      h4: () => insertMarkdown("#### ", "", "四级标题"),
      h5: () => insertMarkdown("##### ", "", "五级标题"),
      h6: () => insertMarkdown("###### ", "", "六级标题"),
      quote: () => insertMarkdown("> ", "", "引用内容"),
      list: () => insertMarkdown("- ", "", "列表项"),
      ordered: () => insertMarkdown("1. ", "", "列表项"),
      task: () => insertMarkdown("- [ ] ", "", "待办事项"),
      link: () => insertMarkdown("[", "](https://example.com)", "链接文字"),
      image: () => insertMarkdown("![图片说明](", ")", "图片地址"),
      inlineCode: () => insertMarkdown("`", "`", "代码"),
      codeBlock: () => insertMarkdown("```text\n", "\n```", "代码块"),
      table: () => insertBlock("| 表头一 | 表头二 | 表头三 |\n| --- | :---: | ---: |\n| 内容 | 居中 | 右对齐 |"),
      hr: () => insertBlock("---"),
      hardBreak: () => insertMarkdown("", "  \n", "上一行内容"),
      htmlBlock: () => insertBlock("<details>\n<summary>展开查看</summary>\n\nHTML 内容\n\n</details>"),
    };
    actions[value]?.();
    setFormatOpen(false);
  }

  function clearAutoSaveTimer() {
    if (!autoSaveTimerRef.current) return;
    window.clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = null;
  }

  function recordVersion(article: Article) {
    setHistory((items) => {
      const latest = items.find((version) => version.articleId === article.id);
      if (latest && latest.title === article.title && latest.markdown === article.markdown) return items;
      const version: ArticleVersion = { id: crypto.randomUUID(), articleId: article.id, title: article.title, markdown: article.markdown, savedAt: new Date().toISOString() };
      const articleVersions = [version, ...items.filter((item) => item.articleId === article.id)].slice(0, maxVersionsPerArticle);
      return [...articleVersions, ...items.filter((item) => item.articleId !== article.id)];
    });
  }

  function persistCurrentArticle(source: "手动保存" | "自动保存" = "手动保存") {
    clearAutoSaveTimer();
    const current = articles.find((article) => article.id === activeId);
    if (!current) return;
    if (current.title === title && current.markdown === markdown) {
      try {
        window.localStorage.setItem(articleStorageKey, JSON.stringify(articles));
        setStorageError(false);
        setSaved("已保存");
      } catch {
        setStorageError(true);
        setSaved("本地存储空间不足");
      }
      return;
    }
    recordVersion(current);
    const updatedAt = new Date().toISOString();
    setArticles((items) => items.map((item) => item.id === activeId ? { ...item, title: title || "未命名文章", markdown, updatedAt } : item));
    setSaved(source === "自动保存" ? "已自动保存" : "已保存");
    window.setTimeout(() => setSaved("立即保存"), 1600);
  }

  function selectArticle(article: Article) {
    if (article.id === activeId) return;
    if (isDirty) persistCurrentArticle("自动保存");
    setActiveId(article.id); setTitle(article.title); setMarkdown(article.markdown); setSaved("立即保存");
  }

  function saveArticle() {
    persistCurrentArticle("手动保存");
  }

  function createArticle() {
    if (isDirty) persistCurrentArticle("自动保存");
    const article: Article = { id: crypto.randomUUID(), title: "未命名文章", markdown: "# 未命名文章\n\n开始写作...", updatedAt: new Date().toISOString() };
    setArticles((items) => [article, ...items]);
    setActiveId(article.id); setTitle(article.title); setMarkdown(article.markdown); setSaved("立即保存");
  }

  function deleteArticle() {
    const current = articles.find((article) => article.id === activeId);
    if (!current || !window.confirm(`确定删除“${current.title || "未命名文章"}”吗？`)) return;
    const remaining = articles.filter((article) => article.id !== activeId);
    setArticles(remaining);
    setHistory((items) => items.filter((version) => version.articleId !== activeId));
    if (remaining.length) {
      setActiveId(remaining[0].id);
      setTitle(remaining[0].title);
      setMarkdown(remaining[0].markdown);
      setSaved("立即保存");
    }
    else {
      setActiveId("");
      setTitle("");
      setMarkdown("");
    }
  }

  function restoreVersion(version: ArticleVersion) {
    if (!window.confirm(`确定恢复 ${formatVersionTime(version.savedAt)} 的版本吗？当前内容会先保存到历史记录。`)) return;
    if (activeId) recordVersion({ id: activeId, title: title || "未命名文章", markdown, updatedAt: new Date().toISOString() });
    clearAutoSaveTimer();
    setTitle(version.title);
    setMarkdown(version.markdown);
    setSaved("已恢复，等待保存");
    setHistoryOpen(false);
  }

  async function importMarkdown(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setMarkdownMessage("文件超过 5MB");
      window.setTimeout(() => setMarkdownMessage(""), 1800);
      return;
    }
    try {
      const content = (await file.text()).replace(/^\uFEFF/, "");
      if (!content.trim()) throw new Error("empty markdown");
      if (isDirty) persistCurrentArticle("自动保存");
      const article: Article = { id: crypto.randomUUID(), title: getMarkdownTitle(content, file.name), markdown: content, updatedAt: new Date().toISOString() };
      setArticles((items) => [article, ...items]);
      setActiveId(article.id);
      setTitle(article.title);
      setMarkdown(article.markdown);
      setSaved("已导入并保存");
      setMarkdownMessage("导入成功");
    } catch {
      setMarkdownMessage("导入失败");
    }
    window.setTimeout(() => setMarkdownMessage(""), 1800);
  }

  function exportMarkdown() {
    if (!activeId) return;
    const url = URL.createObjectURL(new Blob([markdown], { type: "text/markdown;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = getMarkdownFilename(title);
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setMarkdownMessage("已导出");
    window.setTimeout(() => setMarkdownMessage(""), 1600);
  }

  function exportLibrary() {
    const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), articles }, null, 2);
    const url = URL.createObjectURL(new Blob([content], { type: "application/json;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wechat-article-library.json";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setLibraryMessage("已导出");
    window.setTimeout(() => setLibraryMessage(""), 1600);
  }

  async function importLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const source = Array.isArray(parsed) ? parsed : parsed.articles;
      if (!Array.isArray(source)) throw new Error("invalid library");
      const usedIds = new Set<string>();
      const imported = source
        .filter((item): item is { id?: unknown; title?: unknown; markdown: string; updatedAt?: unknown } => item && typeof item === "object" && typeof item.markdown === "string")
        .map((item) => {
          const id = typeof item.id === "string" && item.id && !usedIds.has(item.id) ? item.id : crypto.randomUUID();
          usedIds.add(id);
          return { id, title: typeof item.title === "string" ? item.title : "未命名文章", markdown: item.markdown, updatedAt: typeof item.updatedAt === "string" ? item.updatedAt : new Date().toISOString() };
        });
      if (!imported.length) throw new Error("empty library");
      if (!window.confirm(`将用导入的 ${imported.length} 篇文章替换当前文章库，是否继续？`)) return;
      clearAutoSaveTimer();
      setArticles(imported);
      setHistory([]);
      setActiveId(imported[0].id);
      setTitle(imported[0].title);
      setMarkdown(imported[0].markdown);
      setSaved("已导入并保存");
      setLibraryMessage("已导入");
    } catch {
      setLibraryMessage("导入失败");
    }
    window.setTimeout(() => setLibraryMessage(""), 1800);
  }

  async function copyForWechat() {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) await navigator.clipboard.write([new ClipboardItem({ "text/html": new Blob([copyHtml], { type: "text/html" }), "text/plain": new Blob([copyPlainText], { type: "text/plain" }) })]);
      else await navigator.clipboard.writeText(copyPlainText);
      setCopied("已复制正文");
    } catch {
      await navigator.clipboard.writeText(copyPlainText); setCopied("已复制文本");
    }
    window.setTimeout(() => setCopied("复制正文"), 1600);
  }

  async function copyPlainField(key: string, value: string) {
    await navigator.clipboard.writeText(value); setFieldCopied(key); window.setTimeout(() => setFieldCopied(null), 1400);
  }

  function exportHtml() {
    const exportHtmlContent = buildExportHtml(title, bodyHtml, theme);
    const url = URL.createObjectURL(new Blob([exportHtmlContent], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "wechat-article.html"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url);
  }

  return <main className="workspace">
    <header className="topbar">
      <div><p className="eyebrow">WeChat Formatter</p><h1>公众号排版助手</h1></div>
      <div className="topbarActions"><button className="ghostButton" type="button" title={hasUnsavedChanges ? "立即保存当前修改" : "当前内容已保存"} onClick={saveArticle}>{saved}</button><button className="ghostButton" type="button" onClick={() => setHistoryOpen(true)} disabled={!activeId}>历史版本{currentHistory.length ? ` (${currentHistory.length})` : ""}</button><button className="ghostButton" type="button" onClick={() => markdownFileInputRef.current?.click()}>{markdownMessage && markdownMessage !== "已导出" ? markdownMessage : "导入 .md"}</button><button className="ghostButton" type="button" onClick={exportMarkdown} disabled={!activeId}>{markdownMessage === "已导出" ? "已导出" : "导出 .md"}</button><button className="ghostButton" type="button" onClick={deleteArticle} disabled={!activeId}>删除文章</button><button className="ghostButton" type="button" onClick={exportLibrary}>{libraryMessage || "导出 JSON"}</button><button className="ghostButton" type="button" onClick={() => fileInputRef.current?.click()}>{libraryMessage || "导入 JSON"}</button><button className="ghostButton" type="button" onClick={exportHtml}>导出 HTML</button><button className="primaryButton" type="button" onClick={copyForWechat}>{copied}</button></div>
      <input ref={fileInputRef} className="visuallyHidden" type="file" accept="application/json,.json" onChange={importLibrary} />
      <input ref={markdownFileInputRef} className="visuallyHidden" type="file" accept=".md,.markdown,text/markdown,text/plain" onChange={importMarkdown} />
    </header>

    <section className="appGrid">
      <aside className="articleList" aria-label="文章列表">
        <div className="listHead"><div><p className="panelKicker">草稿库</p><h2>文章</h2></div><div className="articleListActions"><button className="addArticle" type="button" title="新建文章" onClick={createArticle}>+</button></div></div>
        <div className="articleItems">{articles.map((article) => <button key={article.id} type="button" className={article.id === activeId ? "articleItem active" : "articleItem"} onClick={() => selectArticle(article)}><strong>{article.title || "未命名文章"}</strong><span>{stripMarkdown(article.markdown) || "暂无内容"}</span><em>{formatUpdatedAt(article.updatedAt)}</em></button>)}</div>
      </aside>

      <section className="editorPanel" aria-label="Markdown 编辑器">
        <div className="panelHead"><div><p className="panelKicker">草稿</p><h2>Markdown 编辑</h2></div><div className="panelHeadActions"><span className={`saveState${hasUnsavedChanges ? " dirty" : ""}`}>{storageError ? "⚠ 存储失败" : isDirty ? "● 未保存" : "✓ 已保存"}</span><button className={`syncToggle${syncScroll ? " active" : ""}`} type="button" aria-pressed={syncScroll} title="编辑区与手机预览按阅读进度同步滚动" onClick={() => setSyncScroll((enabled) => !enabled)}>同步滚动 · {syncScroll ? "开" : "关"}</button><div className="metricPill">{readMinutes} 分钟阅读</div></div></div>
        <div className="titleFields"><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="填写文章标题" /></label></div>
        <div className="toolbar" aria-label="排版工具">
          <button type="button" title="加粗" onClick={() => applyFormat("bold")}>B</button><button type="button" title="引用" onClick={() => applyFormat("quote")}>“</button><button type="button" title="无序列表" onClick={() => applyFormat("list")}>列表</button><button type="button" title="行内代码" onClick={() => applyFormat("inlineCode")}>{"</>"}</button><button type="button" title="代码块" onClick={() => applyFormat("codeBlock")}>{"{ }"}</button>
          <div className="formatPicker"><button className="formatTrigger" type="button" aria-expanded={formatOpen} onClick={() => setFormatOpen((open) => !open)}>格式 <span>⌄</span></button>{formatOpen && <div className="formatMenu" role="menu">{formatGroups.map((group) => <div className="formatGroup" key={group.label}><p>{group.label}</p>{group.actions.map(([id, label]) => <button key={id} type="button" onClick={() => applyFormat(id)}>{label}</button>)}</div>)}</div>}</div>
        </div>
        {pasteMessage && <div className="pasteNotice" role="status">{pasteMessage}</div>}
        <textarea ref={textareaRef} className="markdownInput" value={markdown} onChange={(event) => setMarkdown(event.target.value)} onPaste={handleEditorPaste} onScroll={(event) => syncScrollPosition(event.currentTarget, previewRef.current)} spellCheck={false} />
        <div className="editorStats"><span>{characterCount} 字</span><span>{headingCount} 个小标题</span><span>{imageCount} 张图片</span></div>
      </section>

      <section className="previewPanel" aria-label="公众号预览"><div className="phoneShell"><div className="phoneTop"><span>公众号</span><span>{syncScroll ? "同步预览" : "预览"}</span></div><article ref={previewRef} className="wechatArticle" style={themeVars} onScroll={(event) => syncScrollPosition(event.currentTarget, textareaRef.current)}><header className="articleHeader"><h2>{title || "未命名文章"}</h2><p>草稿</p></header><div className="articleBody" dangerouslySetInnerHTML={{ __html: bodyHtml }} /></article></div></section>

      <aside className="publishPanel" aria-label="发布设置">
        <div className="panelHead"><div><p className="panelKicker">设置</p><h2>发布准备</h2></div></div>
        <div className="sectionBlock"><h3>微信字段</h3><div className="fieldCopyGrid"><button type="button" onClick={() => copyPlainField("title", title)}>{fieldCopied === "title" ? "已复制标题" : "复制标题"}</button></div><p className="fieldHint">标题需要单独粘贴到公众号后台；作者与封面由公众号后台自行填写和编辑。</p></div>
        <div className="sectionBlock"><h3>排版主题</h3><div className="themeGrid">{themes.map((item) => <button className={item.id === themeId ? "themeOption active" : "themeOption"} key={item.id} style={{ "--swatch": item.accent } as CSSProperties} type="button" onClick={() => setThemeId(item.id)}><span />{item.name}</button>)}</div></div>
        <div className="publishFooter"><button className="primaryButton wide" type="button" onClick={copyForWechat}>{copied}</button><p>复制正文后粘贴到公众号编辑器，再填写标题、作者和封面。</p></div>
      </aside>
    </section>

    {historyOpen && <div className="historyOverlay" role="presentation" onClick={() => setHistoryOpen(false)}><section className="historyDialog" role="dialog" aria-modal="true" aria-labelledby="history-title" onClick={(event) => event.stopPropagation()}><div className="historyHeader"><div><p className="panelKicker">自动备份</p><h2 id="history-title">历史版本</h2></div><button type="button" aria-label="关闭历史版本" onClick={() => setHistoryOpen(false)}>×</button></div><p className="historyHint">每次自动或手动保存前保留旧内容，每篇文章最多保存 {maxVersionsPerArticle} 个版本。</p><div className="historyList">{currentHistory.length ? currentHistory.map((version) => <article className="historyItem" key={version.id}><div><strong>{formatVersionTime(version.savedAt)}</strong><span>{version.markdown.replace(/\s+/g, " ").slice(0, 90) || "空白内容"}</span><em>{stripMarkdown(version.markdown).replace(/\s/g, "").length} 字</em></div><button type="button" onClick={() => restoreVersion(version)}>恢复此版本</button></article>) : <div className="historyEmpty">还没有历史版本。编辑内容并等待自动保存后，这里会出现可恢复版本。</div>}</div></section></div>}
  </main>;
}
