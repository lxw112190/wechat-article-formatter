import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";

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

function stripMarkdown(value: string) {
  return value.replace(/```[\s\S]*?```/g, " ").replace(/!\[[^\]]*\]\([^)]*\)/g, " ").replace(/\[[^\]]+\]\([^)]*\)/g, (match) => match.slice(1).split("](")[0]).replace(/[#>*_`~\-\d.]/g, " ").replace(/\s+/g, " ").trim();
}

function inlineMarkdown(value: string, theme: Theme) {
  let text = escapeHtml(value);
  text = text.replace(/`([^`]+)`/g, `<code style="padding:2px 6px;border-radius:4px;background:${theme.codeBg};color:${theme.heading};font-size:90%;">$1</code>`);
  text = text.replace(/\*\*([^*]+)\*\*/g, `<strong style="color:${theme.heading};font-weight:700;">$1</strong>`);
  text = text.replace(/\*([^*]+)\*/g, `<em style="color:${theme.muted};font-style:italic;">$1</em>`);
  return text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, `<a href="$2" style="color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.border};">$1</a>`);
}

function renderMarkdown(markdown: string, theme: Theme) {
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let ordered = false;
  let inCode = false;
  let codeLines: string[] = [];
  const paragraphStyle = `margin:0 0 18px;color:${theme.text};font-size:16px;line-height:1.85;letter-spacing:0;`;
  const flushParagraph = () => {
    if (paragraph.length) html.push(`<p style="${paragraphStyle}">${paragraph.map((line) => inlineMarkdown(line, theme)).join("<br/>")}</p>`);
    paragraph = [];
  };
  const flushList = () => {
    if (listItems.length) {
      const tag = ordered ? "ol" : "ul";
      html.push(`<${tag} style="margin:0 0 20px;padding-left:24px;color:${theme.text};font-size:16px;line-height:1.85;">${listItems.join("")}</${tag}>`);
    }
    listItems = [];
  };
  const flushCode = () => {
    html.push(`<pre style="margin:8px 0 22px;padding:16px;border-radius:6px;background:${theme.codeBg};border:1px solid ${theme.border};overflow:auto;color:${theme.heading};font-size:14px;line-height:1.7;"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`);
    codeLines = [];
  };

  markdown.split(/\r?\n/).forEach((rawLine) => {
    const line = rawLine.trimEnd();
    if (line.startsWith("```")) {
      flushParagraph(); flushList();
      if (inCode) { flushCode(); inCode = false; } else inCode = true;
      return;
    }
    if (inCode) { codeLines.push(rawLine); return; }
    if (!line.trim()) { flushParagraph(); flushList(); return; }
    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph(); flushList();
      html.push(`<figure style="margin:8px 0 24px;"><img src="${escapeHtml(image[2])}" alt="${escapeHtml(image[1])}" style="display:block;width:100%;border-radius:6px;border:1px solid ${theme.border};"/><figcaption style="margin-top:8px;text-align:center;color:${theme.muted};font-size:13px;">${escapeHtml(image[1])}</figcaption></figure>`);
      return;
    }
    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph(); flushList();
      const level = heading[1].length;
      const content = inlineMarkdown(heading[2], theme);
      if (level === 1) html.push(`<h1 style="margin:0 0 22px;color:${theme.heading};font-size:24px;line-height:1.35;font-weight:800;">${content}</h1>`);
      else if (level === 2) html.push(`<h2 style="margin:34px 0 16px;padding-left:12px;border-left:4px solid ${theme.accent};color:${theme.heading};font-size:20px;line-height:1.45;font-weight:750;">${content}</h2>`);
      else html.push(`<h3 style="margin:26px 0 12px;color:${theme.heading};font-size:17px;line-height:1.5;font-weight:700;">${content}</h3>`);
      return;
    }
    if (line.startsWith(">")) {
      flushParagraph(); flushList();
      html.push(`<blockquote style="margin:8px 0 22px;padding:14px 16px;border-left:4px solid ${theme.accent};background:${theme.accentSoft};color:${theme.heading};font-size:15px;line-height:1.8;">${inlineMarkdown(line.replace(/^>\s?/, ""), theme)}</blockquote>`);
      return;
    }
    const unordered = line.match(/^[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || orderedItem) {
      flushParagraph();
      const nextOrdered = Boolean(orderedItem);
      if (listItems.length && ordered !== nextOrdered) flushList();
      ordered = nextOrdered;
      listItems.push(`<li style="margin:4px 0;">${inlineMarkdown(unordered?.[1] ?? orderedItem?.[1] ?? "", theme)}</li>`);
      return;
    }
    paragraph.push(line);
  });
  if (inCode) flushCode();
  flushParagraph(); flushList();
  return html.join("");
}

function buildCopyHtml(bodyHtml: string) {
  return `<section style="max-width:677px;margin:0 auto;padding:24px 0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">${bodyHtml}</section>`;
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

export default function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [articles, setArticles] = useState(getSavedArticles);
  const [activeId, setActiveId] = useState(() => getSavedArticles()[0].id);
  const [markdown, setMarkdown] = useState(() => getSavedArticles()[0].markdown);
  const [title, setTitle] = useState(() => getSavedArticles()[0].title);
  const [themeId, setThemeId] = useState(themes[0].id);
  const [copied, setCopied] = useState("复制正文");
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState("保存草稿");
  const [libraryMessage, setLibraryMessage] = useState("");
  const [formatOpen, setFormatOpen] = useState(false);

  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  const bodyHtml = useMemo(() => renderMarkdown(markdown, theme), [markdown, theme]);
  const copyHtml = useMemo(() => buildCopyHtml(bodyHtml), [bodyHtml]);
  const articlePlainText = useMemo(() => stripMarkdown(markdown), [markdown]);
  const copyPlainText = useMemo(() => articlePlainText, [articlePlainText]);
  const characterCount = articlePlainText.replace(/\s/g, "").length;
  const imageCount = (markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const headingCount = (markdown.match(/^#{2,3}\s+/gm) ?? []).length;
  const readMinutes = Math.max(1, Math.ceil(characterCount / 450));
  const themeVars = { "--article-accent": theme.accent, "--article-soft": theme.accentSoft, "--article-heading": theme.heading } as CSSProperties;

  useEffect(() => {
    window.localStorage.setItem(articleStorageKey, JSON.stringify(articles));
  }, [articles]);

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

  function applyFormat(value: string) {
    const actions: Record<string, () => void> = {
      bold: () => insertMarkdown("**", "**"), italic: () => insertMarkdown("*", "*"), h2: () => insertMarkdown("## ", "", "小标题"), h3: () => insertMarkdown("### ", "", "三级标题"), quote: () => insertMarkdown("> ", "", "引用内容"), list: () => insertMarkdown("- ", "", "列表项"), ordered: () => insertMarkdown("1. ", "", "列表项"), link: () => insertMarkdown("[", "](https://example.com)", "链接文字"), image: () => insertMarkdown("![图片说明](", ")", "图片地址"), inlineCode: () => insertMarkdown("`", "`", "代码"), codeBlock: () => insertMarkdown("```\n", "\n```", "代码块"),
    };
    actions[value]?.();
    setFormatOpen(false);
  }

  function selectArticle(article: Article) {
    setActiveId(article.id); setTitle(article.title); setMarkdown(article.markdown); setSaved("保存草稿");
  }

  function saveArticle() {
    if (!activeId) return;
    setArticles((items) => items.map((item) => item.id === activeId ? { ...item, title: title || "未命名文章", markdown, updatedAt: new Date().toISOString() } : item));
    setSaved("已保存");
    window.setTimeout(() => setSaved("保存草稿"), 1400);
  }

  function createArticle() {
    const article: Article = { id: crypto.randomUUID(), title: "未命名文章", markdown: "# 未命名文章\n\n开始写作...", updatedAt: new Date().toISOString() };
    setArticles((items) => [article, ...items]);
    selectArticle(article);
  }

  function deleteArticle() {
    const current = articles.find((article) => article.id === activeId);
    if (!current || !window.confirm(`确定删除“${current.title || "未命名文章"}”吗？`)) return;
    const remaining = articles.filter((article) => article.id !== activeId);
    setArticles(remaining);
    if (remaining.length) selectArticle(remaining[0]);
    else {
      setActiveId("");
      setTitle("");
      setMarkdown("");
    }
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
      setArticles(imported);
      selectArticle(imported[0]);
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
      <div className="topbarActions"><button className="ghostButton" type="button" onClick={saveArticle}>{saved}</button><button className="ghostButton" type="button" onClick={deleteArticle} disabled={!activeId}>删除文章</button><button className="ghostButton" type="button" onClick={exportLibrary}>{libraryMessage || "导出 JSON"}</button><button className="ghostButton" type="button" onClick={() => fileInputRef.current?.click()}>{libraryMessage || "导入 JSON"}</button><button className="ghostButton" type="button" onClick={exportHtml}>导出 HTML</button><button className="primaryButton" type="button" onClick={copyForWechat}>{copied}</button></div>
      <input ref={fileInputRef} className="visuallyHidden" type="file" accept="application/json,.json" onChange={importLibrary} />
    </header>

    <section className="appGrid">
      <aside className="articleList" aria-label="文章列表">
        <div className="listHead"><div><p className="panelKicker">草稿库</p><h2>文章</h2></div><div className="articleListActions"><button className="addArticle" type="button" title="新建文章" onClick={createArticle}>+</button></div></div>
        <div className="articleItems">{articles.map((article) => <button key={article.id} type="button" className={article.id === activeId ? "articleItem active" : "articleItem"} onClick={() => selectArticle(article)}><strong>{article.title || "未命名文章"}</strong><span>{stripMarkdown(article.markdown) || "暂无内容"}</span><em>{formatUpdatedAt(article.updatedAt)}</em></button>)}</div>
      </aside>

      <section className="editorPanel" aria-label="Markdown 编辑器">
        <div className="panelHead"><div><p className="panelKicker">草稿</p><h2>Markdown 编辑</h2></div><div className="metricPill">{readMinutes} 分钟阅读</div></div>
        <div className="titleFields"><label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="填写文章标题" /></label></div>
        <div className="toolbar" aria-label="排版工具">
          <button type="button" title="加粗" onClick={() => insertMarkdown("**", "**")}>B</button><button type="button" title="引用" onClick={() => insertMarkdown("> ", "", "引用内容")}>“</button><button type="button" onClick={() => insertMarkdown("- ", "", "列表项")}>列表</button><button type="button" title="行内代码" onClick={() => insertMarkdown("`", "`", "代码")}>{"</>"}</button><button type="button" title="代码块" onClick={() => insertMarkdown("```\n", "\n```", "代码块")}>{"{ }"}</button>
          <div className="formatPicker"><button className="formatTrigger" type="button" aria-expanded={formatOpen} onClick={() => setFormatOpen((open) => !open)}>格式 <span>⌄</span></button>{formatOpen && <div className="formatMenu" role="menu"><button type="button" onClick={() => applyFormat("bold")}>加粗</button><button type="button" onClick={() => applyFormat("italic")}>斜体</button><button type="button" onClick={() => applyFormat("h2")}>二级标题</button><button type="button" onClick={() => applyFormat("h3")}>三级标题</button><button type="button" onClick={() => applyFormat("quote")}>引用</button><button type="button" onClick={() => applyFormat("list")}>无序列表</button><button type="button" onClick={() => applyFormat("ordered")}>有序列表</button><button type="button" onClick={() => applyFormat("link")}>链接</button><button type="button" onClick={() => applyFormat("image")}>图片</button><button type="button" onClick={() => applyFormat("inlineCode")}>行内代码</button><button type="button" onClick={() => applyFormat("codeBlock")}>代码块</button></div>}</div>
        </div>
        <textarea ref={textareaRef} className="markdownInput" value={markdown} onChange={(event) => setMarkdown(event.target.value)} spellCheck={false} />
        <div className="editorStats"><span>{characterCount} 字</span><span>{headingCount} 个小标题</span><span>{imageCount} 张图片</span></div>
      </section>

      <section className="previewPanel" aria-label="公众号预览"><div className="phoneShell"><div className="phoneTop"><span>公众号</span><span>预览</span></div><article className="wechatArticle" style={themeVars}><header className="articleHeader"><h2>{title || "未命名文章"}</h2><p>草稿</p></header><div className="articleBody" dangerouslySetInnerHTML={{ __html: bodyHtml }} /></article></div></section>

      <aside className="publishPanel" aria-label="发布设置">
        <div className="panelHead"><div><p className="panelKicker">设置</p><h2>发布准备</h2></div></div>
        <div className="sectionBlock"><h3>微信字段</h3><div className="fieldCopyGrid"><button type="button" onClick={() => copyPlainField("title", title)}>{fieldCopied === "title" ? "已复制标题" : "复制标题"}</button></div><p className="fieldHint">标题需要单独粘贴到公众号后台；作者与封面由公众号后台自行填写和编辑。</p></div>
        <div className="sectionBlock"><h3>排版主题</h3><div className="themeGrid">{themes.map((item) => <button className={item.id === themeId ? "themeOption active" : "themeOption"} key={item.id} style={{ "--swatch": item.accent } as CSSProperties} type="button" onClick={() => setThemeId(item.id)}><span />{item.name}</button>)}</div></div>
        <div className="publishFooter"><button className="primaryButton wide" type="button" onClick={copyForWechat}>{copied}</button><p>复制正文后粘贴到公众号编辑器，再填写标题、作者和封面。</p></div>
      </aside>
    </section>
  </main>;
}
