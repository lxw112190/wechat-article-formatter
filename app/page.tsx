"use client";

import { useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";

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

type Cover = {
  id: string;
  name: string;
  className: string;
};

type Check = {
  label: string;
  done: boolean;
  detail: string;
};

const themes: Theme[] = [
  {
    id: "wechat",
    name: "青绿",
    accent: "#12b76a",
    accentSoft: "#e8fbf2",
    heading: "#0f5132",
    text: "#1f2937",
    muted: "#667085",
    border: "#b7ebd1",
    codeBg: "#f1fbf6",
  },
  {
    id: "ink",
    name: "墨蓝",
    accent: "#2563eb",
    accentSoft: "#eef4ff",
    heading: "#172554",
    text: "#1e293b",
    muted: "#64748b",
    border: "#bfdbfe",
    codeBg: "#f5f7fb",
  },
  {
    id: "warm",
    name: "暖刊",
    accent: "#d97706",
    accentSoft: "#fff7ed",
    heading: "#7c2d12",
    text: "#2f2a24",
    muted: "#756b61",
    border: "#fed7aa",
    codeBg: "#fffaf2",
  },
];

const covers: Cover[] = [
  { id: "green", name: "增长复盘", className: "coverGreen" },
  { id: "blue", name: "产品观察", className: "coverBlue" },
  { id: "amber", name: "运营手记", className: "coverAmber" },
];

const starterMarkdown = `# 一篇公众号文章，从草稿到可发布

## 先把读者放在第一屏

公众号的开头不需要铺太长。用一句具体判断接住读者，再给出这篇文章要解决的问题。

> 好的排版不是装饰，而是降低阅读阻力。

## 用结构替代堆叠

- 每一节只承载一个观点
- 小标题要能被单独扫读
- 重点句可以加粗，但不要每段都加粗

## 发布前检查三件事

1. 标题是否足够明确
2. 摘要是否像一个自然的人写出来
3. 封面和正文是否讲的是同一件事

### 可直接粘贴的素材

\`\`\`
把这段 HTML 复制到公众号后台，正文样式会尽量保留。
\`\`\`

最后，给文章留一个清晰的收束：读者读完之后，应该知道下一步做什么。`;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function stripMarkdown(value: string) {
  return value
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]+\]\([^)]*\)/g, (match) => match.slice(1).split("](")[0])
    .replace(/[#>*_`~\-\d.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inlineMarkdown(value: string, theme: Theme) {
  let text = escapeHtml(value);
  text = text.replace(
    /`([^`]+)`/g,
    `<code style="padding:2px 6px;border-radius:4px;background:${theme.codeBg};color:${theme.heading};font-size:90%;">$1</code>`,
  );
  text = text.replace(
    /\*\*([^*]+)\*\*/g,
    `<strong style="color:${theme.heading};font-weight:700;">$1</strong>`,
  );
  text = text.replace(
    /\*([^*]+)\*/g,
    `<em style="color:${theme.muted};font-style:italic;">$1</em>`,
  );
  text = text.replace(
    /\[([^\]]+)\]\(([^)]+)\)/g,
    `<a href="$2" style="color:${theme.accent};text-decoration:none;border-bottom:1px solid ${theme.border};">$1</a>`,
  );
  return text;
}

function renderMarkdown(markdown: string, theme: Theme) {
  const lines = markdown.split(/\r?\n/);
  const html: string[] = [];
  let paragraph: string[] = [];
  let listItems: string[] = [];
  let ordered = false;
  let inCode = false;
  let codeLines: string[] = [];

  const paragraphStyle =
    `margin:0 0 18px;color:${theme.text};font-size:16px;line-height:1.85;letter-spacing:0;`;
  const flushParagraph = () => {
    if (!paragraph.length) return;
    html.push(
      `<p style="${paragraphStyle}">${paragraph.map((line) => inlineMarkdown(line, theme)).join("<br/>")}</p>`,
    );
    paragraph = [];
  };
  const flushList = () => {
    if (!listItems.length) return;
    const tag = ordered ? "ol" : "ul";
    html.push(
      `<${tag} style="margin:0 0 20px 0;padding-left:24px;color:${theme.text};font-size:16px;line-height:1.85;">${listItems.join("")}</${tag}>`,
    );
    listItems = [];
  };

  lines.forEach((rawLine) => {
    const line = rawLine.trimEnd();

    if (line.startsWith("```")) {
      flushParagraph();
      flushList();
      if (inCode) {
        html.push(
          `<pre style="margin:8px 0 22px;padding:16px;border-radius:6px;background:${theme.codeBg};border:1px solid ${theme.border};overflow:auto;color:${theme.heading};font-size:14px;line-height:1.7;"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
        );
        codeLines = [];
        inCode = false;
      } else {
        inCode = true;
      }
      return;
    }

    if (inCode) {
      codeLines.push(rawLine);
      return;
    }

    if (!line.trim()) {
      flushParagraph();
      flushList();
      return;
    }

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      flushParagraph();
      flushList();
      const [, alt, src] = image;
      html.push(
        `<figure style="margin:8px 0 24px;"><img src="${escapeHtml(src)}" alt="${escapeHtml(alt)}" style="display:block;width:100%;border-radius:6px;border:1px solid ${theme.border};"/><figcaption style="margin-top:8px;text-align:center;color:${theme.muted};font-size:13px;">${escapeHtml(alt)}</figcaption></figure>`,
      );
      return;
    }

    const heading = line.match(/^(#{1,3})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      const level = heading[1].length;
      const content = inlineMarkdown(heading[2], theme);
      if (level === 1) {
        html.push(
          `<h1 style="margin:0 0 22px;color:${theme.heading};font-size:24px;line-height:1.35;font-weight:800;">${content}</h1>`,
        );
      } else if (level === 2) {
        html.push(
          `<h2 style="margin:34px 0 16px;padding:0 0 0 12px;border-left:4px solid ${theme.accent};color:${theme.heading};font-size:20px;line-height:1.45;font-weight:750;">${content}</h2>`,
        );
      } else {
        html.push(
          `<h3 style="margin:26px 0 12px;color:${theme.heading};font-size:17px;line-height:1.5;font-weight:700;">${content}</h3>`,
        );
      }
      return;
    }

    if (line.startsWith(">")) {
      flushParagraph();
      flushList();
      html.push(
        `<blockquote style="margin:8px 0 22px;padding:14px 16px;border-left:4px solid ${theme.accent};background:${theme.accentSoft};color:${theme.heading};font-size:15px;line-height:1.8;">${inlineMarkdown(line.replace(/^>\s?/, ""), theme)}</blockquote>`,
      );
      return;
    }

    const unordered = line.match(/^[-*]\s+(.+)$/);
    const orderedItem = line.match(/^\d+\.\s+(.+)$/);
    if (unordered || orderedItem) {
      flushParagraph();
      const nextOrdered = Boolean(orderedItem);
      if (listItems.length && ordered !== nextOrdered) {
        flushList();
      }
      ordered = nextOrdered;
      const itemText = unordered?.[1] ?? orderedItem?.[1] ?? "";
      listItems.push(`<li style="margin:4px 0;">${inlineMarkdown(itemText, theme)}</li>`);
      return;
    }

    paragraph.push(line);
  });

  if (inCode) {
    html.push(
      `<pre style="margin:8px 0 22px;padding:16px;border-radius:6px;background:${theme.codeBg};border:1px solid ${theme.border};overflow:auto;color:${theme.heading};font-size:14px;line-height:1.7;"><code>${escapeHtml(codeLines.join("\n"))}</code></pre>`,
    );
  }
  flushParagraph();
  flushList();
  return html.join("");
}

function buildCopyHtml(
  title: string,
  author: string,
  summary: string,
  bodyHtml: string,
  theme: Theme,
) {
  return `<section style="max-width:677px;margin:0 auto;padding:24px 0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <h1 style="margin:0 0 10px;color:${theme.heading};font-size:26px;line-height:1.35;font-weight:800;">${escapeHtml(title)}</h1>
  <p style="margin:0 0 18px;color:${theme.muted};font-size:14px;line-height:1.6;">${escapeHtml(author)} · 公众号草稿</p>
  <p style="margin:0 0 24px;padding:14px 16px;border-radius:6px;background:${theme.accentSoft};color:${theme.heading};font-size:15px;line-height:1.8;">${escapeHtml(summary)}</p>
  ${bodyHtml}
</section>`;
}

export default function Home() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [markdown, setMarkdown] = useState(starterMarkdown);
  const [themeId, setThemeId] = useState(themes[0].id);
  const [coverId, setCoverId] = useState(covers[0].id);
  const [title, setTitle] = useState("一篇公众号文章，从草稿到可发布");
  const [author, setAuthor] = useState("内容运营部");
  const [summary, setSummary] = useState("把 Markdown 草稿整理成适合公众号后台粘贴的排版稿，发布前顺手完成标题、摘要、封面和结构检查。");
  const [copied, setCopied] = useState("复制发布稿");
  const [mode, setMode] = useState("立即发布");

  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  const cover = covers.find((item) => item.id === coverId) ?? covers[0];
  const bodyHtml = useMemo(() => renderMarkdown(markdown, theme), [markdown, theme]);
  const copyHtml = useMemo(
    () => buildCopyHtml(title, author, summary, bodyHtml, theme),
    [author, bodyHtml, summary, theme, title],
  );
  const plainText = useMemo(() => stripMarkdown(markdown), [markdown]);
  const characterCount = plainText.replace(/\s/g, "").length;
  const imageCount = (markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const headingCount = (markdown.match(/^#{2,3}\s+/gm) ?? []).length;
  const readMinutes = Math.max(1, Math.ceil(characterCount / 450));
  const checks: Check[] = [
    {
      label: "标题",
      done: title.length >= 8 && title.length <= 30,
      detail: `${title.length}/30 字`,
    },
    {
      label: "摘要",
      done: summary.length >= 24,
      detail: `${summary.length} 字`,
    },
    {
      label: "结构",
      done: headingCount >= 2,
      detail: `${headingCount} 个小标题`,
    },
    {
      label: "正文",
      done: characterCount >= 500 && characterCount <= 5000,
      detail: `${characterCount} 字`,
    },
    {
      label: "封面",
      done: Boolean(coverId),
      detail: cover.name,
    },
  ];
  const completedChecks = checks.filter((item) => item.done).length;
  const score = Math.round((completedChecks / checks.length) * 100);

  const themeVars = {
    "--article-accent": theme.accent,
    "--article-soft": theme.accentSoft,
    "--article-heading": theme.heading,
  } as CSSProperties;

  function insertMarkdown(before: string, after = "", fallback = "重点内容") {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selected = markdown.slice(start, end) || fallback;
    const next = `${markdown.slice(0, start)}${before}${selected}${after}${markdown.slice(end)}`;
    setMarkdown(next);
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = start + before.length;
      textarea.selectionEnd = start + before.length + selected.length;
    });
  }

  async function copyForWechat() {
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([copyHtml], { type: "text/html" }),
            "text/plain": new Blob([plainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(plainText);
      }
      setCopied("已复制");
      window.setTimeout(() => setCopied("复制发布稿"), 1600);
    } catch {
      await navigator.clipboard.writeText(plainText);
      setCopied("已复制文本");
      window.setTimeout(() => setCopied("复制发布稿"), 1600);
    }
  }

  function exportHtml() {
    const blob = new Blob([copyHtml], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wechat-article.html";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">WeChat Publisher</p>
          <h1>公众号发布台</h1>
        </div>
        <div className="topbarActions">
          <button className="ghostButton" type="button" onClick={exportHtml}>
            导出 HTML
          </button>
          <button className="primaryButton" type="button" onClick={copyForWechat}>
            {copied}
          </button>
        </div>
      </header>

      <section className="appGrid">
        <section className="editorPanel" aria-label="Markdown 编辑器">
          <div className="panelHead">
            <div>
              <p className="panelKicker">草稿</p>
              <h2>Markdown 编辑</h2>
            </div>
            <div className="metricPill">{readMinutes} 分钟阅读</div>
          </div>

          <div className="titleFields">
            <label>
              标题
              <input value={title} onChange={(event) => setTitle(event.target.value)} />
            </label>
            <label>
              作者
              <input value={author} onChange={(event) => setAuthor(event.target.value)} />
            </label>
          </div>

          <label className="summaryField">
            摘要
            <textarea value={summary} onChange={(event) => setSummary(event.target.value)} />
          </label>

          <div className="toolbar" aria-label="排版工具">
            <button type="button" onClick={() => insertMarkdown("**", "**")}>
              B
            </button>
            <button type="button" onClick={() => insertMarkdown("*", "*")}>
              I
            </button>
            <button type="button" onClick={() => insertMarkdown("## ", "", "小标题")}>
              H2
            </button>
            <button type="button" onClick={() => insertMarkdown("> ", "", "引用内容")}>
              “”
            </button>
            <button type="button" onClick={() => insertMarkdown("- ", "", "列表项")}>
              列表
            </button>
            <button type="button" onClick={() => insertMarkdown("`", "`", "代码")}>
              {"</>"}
            </button>
          </div>

          <textarea
            ref={textareaRef}
            className="markdownInput"
            value={markdown}
            onChange={(event) => setMarkdown(event.target.value)}
            spellCheck={false}
          />

          <div className="editorStats">
            <span>{characterCount} 字</span>
            <span>{headingCount} 个小标题</span>
            <span>{imageCount} 张图片</span>
          </div>
        </section>

        <section className="previewPanel" aria-label="公众号预览">
          <div className="phoneShell">
            <div className="phoneTop">
              <span>公众号</span>
              <span>预览</span>
            </div>
            <article className="wechatArticle" style={themeVars}>
              <div className={`coverArt ${cover.className}`}>
                <span>{cover.name}</span>
              </div>
              <header className="articleHeader">
                <h2>{title}</h2>
                <p>
                  {author} · 草稿 · {mode}
                </p>
                <div>{summary}</div>
              </header>
              <div
                className="articleBody"
                dangerouslySetInnerHTML={{ __html: bodyHtml }}
              />
            </article>
          </div>
        </section>

        <aside className="publishPanel" aria-label="发布设置">
          <div className="panelHead">
            <div>
              <p className="panelKicker">设置</p>
              <h2>发布准备</h2>
            </div>
            <strong className="score">{score}</strong>
          </div>

          <div className="sectionBlock">
            <h3>排版主题</h3>
            <div className="themeGrid">
              {themes.map((item) => (
                <button
                  className={item.id === themeId ? "themeOption active" : "themeOption"}
                  key={item.id}
                  style={{ "--swatch": item.accent } as CSSProperties}
                  type="button"
                  onClick={() => setThemeId(item.id)}
                >
                  <span />
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sectionBlock">
            <h3>封面</h3>
            <div className="coverList">
              {covers.map((item) => (
                <button
                  className={item.id === coverId ? "coverOption active" : "coverOption"}
                  key={item.id}
                  type="button"
                  onClick={() => setCoverId(item.id)}
                >
                  <span className={item.className} />
                  {item.name}
                </button>
              ))}
            </div>
          </div>

          <div className="sectionBlock">
            <h3>发布方式</h3>
            <div className="segmented">
              {["立即发布", "定时发布", "仅存草稿"].map((item) => (
                <button
                  className={mode === item ? "active" : ""}
                  key={item}
                  type="button"
                  onClick={() => setMode(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="sectionBlock">
            <h3>发布检查</h3>
            <div className="checkList">
              {checks.map((item) => (
                <div className={item.done ? "checkItem done" : "checkItem"} key={item.label}>
                  <span>{item.done ? "✓" : "!"}</span>
                  <strong>{item.label}</strong>
                  <em>{item.detail}</em>
                </div>
              ))}
            </div>
          </div>

          <div className="publishFooter">
            <button className="primaryButton wide" type="button" onClick={copyForWechat}>
              {copied}
            </button>
            <p>复制后可粘贴到公众号后台正文编辑器。</p>
          </div>
        </aside>
      </section>
    </main>
  );
}
