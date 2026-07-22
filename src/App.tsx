import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ClipboardEvent as ReactClipboardEvent, CSSProperties, DragEvent as ReactDragEvent } from "react";
import {
  compressImageFile,
  deleteImageAsset,
  deleteUnusedImageAssets,
  describeStorageError,
  getAllImageAssets,
  getArticleImageAssets,
  putImageAsset,
  replaceAllImageAssets,
} from "./imageAssets";
import type { ImageAsset } from "./imageAssets";
import { getLocalAssetReferences as findLocalAssetReferences, getReferencedAssetIds } from "./markdown/assets";
import { getMarkdownOutline as buildMarkdownOutline } from "./markdown/outline";
import { convertPastedHtml as convertPastedContent } from "./markdown/pasteConverter";
import { inspectBeforePublish as runPreflightChecks } from "./markdown/preflight";
import {
  buildCopyHtml as createCopyHtml,
  buildCopyPlainText as createCopyPlainText,
  buildExportHtml as createExportHtml,
  renderMarkdown as createRenderedMarkdown,
  stripMarkdown as getPlainText,
} from "./markdown/renderMarkdown";
import {
  articleStorageKey as articleStorageKeyV2,
  getMarkdownFilename as createMarkdownFilename,
  getMarkdownTitle as extractMarkdownTitle,
  historyStorageKey as historyStorageKeyV2,
  loadArticles,
  loadHistory,
  parseLegacyLibrary,
  saveArticleData,
} from "./services/articleStorage";
import { createCompleteBackup, getBackupFilename, readCompleteBackup } from "./services/backup";
import { openPrintPreview } from "./services/print";
import { themes } from "./themes/themes";
import type { Article, ArticleVersion, OutlineItem } from "./types";

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

const maxVersionsPerArticle = 30;
const appVersion = "0.1.0";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

const formatGroups = [
  {
    label: "文字",
    actions: [
      ["bold", "加粗"],
      ["italic", "斜体"],
      ["strike", "删除线"],
      ["inlineCode", "行内代码"],
      ["link", "链接"],
    ],
  },
  {
    label: "标题",
    actions: [
      ["h1", "一级标题"],
      ["h2", "二级标题"],
      ["h3", "三级标题"],
      ["h4", "四级标题"],
      ["h5", "五级标题"],
      ["h6", "六级标题"],
    ],
  },
  {
    label: "内容块",
    actions: [
      ["quote", "引用"],
      ["list", "无序列表"],
      ["ordered", "有序列表"],
      ["task", "任务列表"],
      ["codeBlock", "代码块"],
      ["table", "表格"],
      ["image", "图片"],
      ["hr", "分隔线"],
      ["hardBreak", "强制换行"],
      ["htmlBlock", "HTML 块"],
    ],
  },
] as const;

export default function App() {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const previewRef = useRef<HTMLElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupInputRef = useRef<HTMLInputElement>(null);
  const markdownFileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const syncTargetRef = useRef<HTMLElement | null>(null);
  const outlineNavigationRef = useRef(false);
  const autoSaveTimerRef = useRef<number | null>(null);
  const pasteNoticeTimerRef = useRef<number | null>(null);
  const imageMessageTimerRef = useRef<number | null>(null);
  const assetUrlsRef = useRef<Record<string, string>>({});
  const formatRef = useRef<HTMLDivElement>(null);
  const initialSavedArticles = useMemo(() => loadArticles(window.localStorage, initialArticles), []);
  const [articles, setArticles] = useState(initialSavedArticles);
  const [history, setHistory] = useState<ArticleVersion[]>(() => loadHistory(window.localStorage));
  const [activeId, setActiveId] = useState(() => initialSavedArticles[0].id);
  const [markdown, setMarkdown] = useState(() => initialSavedArticles[0].markdown);
  const [title, setTitle] = useState(() => initialSavedArticles[0].title);
  const [themeId, setThemeId] = useState(themes[0].id);
  const [copied, setCopied] = useState("复制正文");
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState("立即保存");
  const [storageError, setStorageError] = useState(false);
  const [libraryMessage, setLibraryMessage] = useState("");
  const [backupMessage, setBackupMessage] = useState("");
  const [appError, setAppError] = useState("");
  const [markdownMessage, setMarkdownMessage] = useState("");
  const [pasteMessage, setPasteMessage] = useState("");
  const [imageMessage, setImageMessage] = useState("");
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetLibraryReady, setAssetLibraryReady] = useState(false);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [replaceAssetId, setReplaceAssetId] = useState<string | null>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [activeOutlineIndex, setActiveOutlineIndex] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(() => window.localStorage.getItem("wechat-editor-outline") !== "false");
  const [syncScroll, setSyncScroll] = useState(() => window.localStorage.getItem("wechat-sync-scroll") !== "false");

  const theme = themes.find((item) => item.id === themeId) ?? themes[0];
  const bodyHtml = useMemo(() => createRenderedMarkdown(markdown, theme, assetUrls), [markdown, theme, assetUrls]);
  const copyHtml = useMemo(() => createCopyHtml(bodyHtml, theme), [bodyHtml, theme]);
  const articlePlainText = useMemo(() => getPlainText(markdown), [markdown]);
  const copyPlainText = useMemo(() => createCopyPlainText(markdown), [markdown]);
  const localAssetReferences = useMemo(() => findLocalAssetReferences(markdown), [markdown]);
  const outline = useMemo(() => buildMarkdownOutline(markdown), [markdown]);
  const characterCount = articlePlainText.replace(/\s/g, "").length;
  const imageCount = (markdown.match(/!\[[^\]]*\]\([^)]*\)/g) ?? []).length;
  const headingCount = outline.length;
  const readMinutes = Math.max(1, Math.ceil(characterCount / 450));
  const preflightIssues = useMemo(
    () => runPreflightChecks(title, markdown, articlePlainText, outline, imageAssets, assetLibraryReady),
    [title, markdown, articlePlainText, outline, imageAssets, assetLibraryReady],
  );
  const preflightErrors = preflightIssues.filter((issue) => issue.status === "error");
  const preflightWarnings = preflightIssues.filter((issue) => issue.status === "warning");
  const preflightPasses = preflightIssues.filter((issue) => issue.status === "pass").length;
  const activeArticle = articles.find((article) => article.id === activeId);
  const isDirty = Boolean(activeArticle && (activeArticle.title !== title || activeArticle.markdown !== markdown));
  const hasUnsavedChanges = isDirty || storageError;
  const currentHistory = history
    .filter((version) => version.articleId === activeId)
    .sort((a, b) => Date.parse(b.savedAt) - Date.parse(a.savedAt));
  const themeVars = {
    "--article-accent": theme.accent,
    "--article-soft": theme.accentSoft,
    "--article-heading": theme.heading,
  } as CSSProperties;

  useEffect(() => {
    try {
      window.localStorage.setItem(articleStorageKeyV2, JSON.stringify(articles));
      setStorageError(false);
    } catch (error) {
      setStorageError(true);
      setSaved("本地存储空间不足");
      setAppError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "文章自动保存失败：浏览器本地存储空间不足。请立即导出完整 ZIP 备份并清理旧草稿。"
          : "文章自动保存失败：无法写入浏览器本地存储。请导出完整 ZIP 备份后刷新页面重试。",
      );
    }
  }, [articles]);

  useEffect(() => {
    try {
      window.localStorage.setItem(historyStorageKeyV2, JSON.stringify(history));
    } catch (error) {
      setSaved("历史记录存储失败");
      setAppError(
        error instanceof DOMException && error.name === "QuotaExceededError"
          ? "历史版本保存失败：浏览器本地存储空间不足。正文仍可编辑，请尽快导出完整 ZIP 备份。"
          : "历史版本保存失败：无法写入浏览器本地存储。",
      );
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
    // The timer intentionally resets only when the editable article fields change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    // Re-synchronize only when the user changes this setting.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncScroll]);

  useEffect(() => {
    window.localStorage.setItem("wechat-editor-outline", String(outlineOpen));
  }, [outlineOpen]);

  useEffect(
    () => () => {
      if (pasteNoticeTimerRef.current) window.clearTimeout(pasteNoticeTimerRef.current);
      if (imageMessageTimerRef.current) window.clearTimeout(imageMessageTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    assetUrlsRef.current = {};
    setAssetUrls({});
    setImageAssets([]);
    setAssetLibraryReady(false);
    if (!activeId) {
      setAssetLibraryReady(true);
      return () => {
        cancelled = true;
      };
    }

    getArticleImageAssets(activeId)
      .then((assets) => {
        if (cancelled) return;
        const urls = Object.fromEntries(assets.map((asset) => [asset.id, URL.createObjectURL(asset.blob)]));
        assetUrlsRef.current = urls;
        setImageAssets(assets);
        setAssetUrls(urls);
        setAssetLibraryReady(true);
      })
      .catch((error) => {
        if (!cancelled) {
          setAssetLibraryReady(true);
          const message = describeStorageError(error, "读取图片素材库");
          setImageMessage(message);
          setAppError(message);
        }
      });

    return () => {
      cancelled = true;
      Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      assetUrlsRef.current = {};
    };
  }, [activeId, assetRefreshKey]);

  useEffect(() => {
    setActiveOutlineIndex((index) => Math.min(index, Math.max(0, outline.length - 1)));
  }, [outline]);

  useEffect(() => {
    if (!formatOpen) return;
    const close = (event: MouseEvent | TouchEvent) => {
      if (formatRef.current && !formatRef.current.contains(event.target as Node)) setFormatOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("touchstart", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("touchstart", close);
    };
  }, [formatOpen]);

  function syncScrollPosition(source: HTMLElement | null, target: HTMLElement | null) {
    if (!syncScroll || outlineNavigationRef.current || !source || !target || syncTargetRef.current === source) return;
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
    let caret = start + content.length;
    setMarkdown((current) => {
      const safeStart = Math.min(start, current.length);
      const safeEnd = Math.min(Math.max(end, safeStart), current.length);
      const before = safeStart > 0 && current[safeStart - 1] !== "\n" ? "\n\n" : "";
      const after = safeEnd < current.length && current[safeEnd] !== "\n" ? "\n\n" : "";
      const replacement = `${before}${content}${after}`;
      caret = safeStart + replacement.length - after.length;
      return `${current.slice(0, safeStart)}${replacement}${current.slice(safeEnd)}`;
    });
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd = caret;
    });
  }

  function updateOutlineFromEditor(position: number) {
    if (!outline.length) return;
    let nextIndex = 0;
    outline.forEach((item, index) => {
      if (item.position <= position) nextIndex = index;
    });
    setActiveOutlineIndex(nextIndex);
  }

  function handlePreviewScroll(source: HTMLElement) {
    syncScrollPosition(source, textareaRef.current);
    const headings = [...source.querySelectorAll<HTMLElement>("[data-outline-index]")];
    if (!headings.length) return;
    const threshold = source.getBoundingClientRect().top + 110;
    let nextIndex = 0;
    headings.forEach((heading) => {
      if (heading.getBoundingClientRect().top <= threshold) nextIndex = Number(heading.dataset.outlineIndex ?? 0);
    });
    setActiveOutlineIndex(nextIndex);
  }

  function navigateToOutline(item: OutlineItem, index: number) {
    setActiveOutlineIndex(index);
    outlineNavigationRef.current = true;
    const textarea = textareaRef.current;
    if (textarea) {
      const lineEnd = markdown.indexOf("\n", item.position);
      textarea.focus();
      textarea.setSelectionRange(item.position, lineEnd < 0 ? markdown.length : lineEnd);
      const lineHeight = Number.parseFloat(window.getComputedStyle(textarea).lineHeight) || 24;
      textarea.scrollTop = Math.max(0, (item.line - 1) * lineHeight - textarea.clientHeight * 0.22);
    }
    const preview = previewRef.current;
    const heading = preview?.querySelector<HTMLElement>(`[data-outline-index="${index}"]`);
    if (preview && heading) {
      const previewTop = preview.getBoundingClientRect().top;
      const headingTop = heading.getBoundingClientRect().top;
      preview.scrollTop = Math.max(0, preview.scrollTop + headingTop - previewTop - 24);
    }
    if (window.matchMedia("(max-width: 700px)").matches) setOutlineOpen(false);
    requestAnimationFrame(() => {
      outlineNavigationRef.current = false;
    });
  }

  function showImageMessage(message: string, duration = 3200) {
    if (imageMessageTimerRef.current) window.clearTimeout(imageMessageTimerRef.current);
    setImageMessage(message);
    imageMessageTimerRef.current = window.setTimeout(() => {
      setImageMessage("");
      imageMessageTimerRef.current = null;
    }, duration);
  }

  function setAssetPreview(asset: ImageAsset) {
    const previousUrl = assetUrlsRef.current[asset.id];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const nextUrls = { ...assetUrlsRef.current, [asset.id]: URL.createObjectURL(asset.blob) };
    assetUrlsRef.current = nextUrls;
    setAssetUrls(nextUrls);
  }

  async function addImageFiles(files: File[]) {
    if (!activeId) {
      showImageMessage("请先新建或选择一篇文章");
      return;
    }
    const selected = files.filter((file) => file.type.startsWith("image/")).slice(0, 10);
    if (!selected.length) return;
    setImageProcessing(true);
    try {
      const added: ImageAsset[] = [];
      for (const file of selected) {
        const defaultAlt = file.name.replace(/\.[^.]+$/, "").trim() || "文章图片";
        const asset = await compressImageFile(file, activeId, file.name || "粘贴图片", {}, undefined, defaultAlt);
        await putImageAsset(asset);
        added.push(asset);
        setAssetPreview(asset);
      }
      setImageAssets((items) => [...items, ...added]);
      insertBlock(added.map((asset) => `![${asset.alt}](asset://${asset.id})`).join("\n\n"));
      const originalSize = added.reduce((total, asset) => total + asset.originalSize, 0);
      const compressedSize = added.reduce((total, asset) => total + asset.compressedSize, 0);
      showImageMessage(`已添加 ${added.length} 张图片：${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
    } catch (error) {
      const message = describeStorageError(error, "添加图片");
      showImageMessage(message);
      setAppError(message);
    } finally {
      setImageProcessing(false);
    }
  }

  function handleImageInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addImageFiles(files);
  }

  function handleEditorDrop(event: ReactDragEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    setDragActive(false);
    if (!files.length) return;
    event.preventDefault();
    void addImageFiles(files);
  }

  function beginReplaceImage(id: string) {
    setReplaceAssetId(id);
    replaceImageInputRef.current?.click();
  }

  async function handleReplaceImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const current = imageAssets.find((asset) => asset.id === replaceAssetId);
    setReplaceAssetId(null);
    if (!file || !current) return;
    setImageProcessing(true);
    try {
      const replacement = await compressImageFile(file, current.articleId, file.name, {}, current.id, current.alt);
      const asset = { ...replacement, createdAt: current.createdAt };
      await putImageAsset(asset);
      setImageAssets((items) => items.map((item) => (item.id === asset.id ? asset : item)));
      setAssetPreview(asset);
      showImageMessage(`已替换 ${asset.id}：${formatBytes(asset.originalSize)} → ${formatBytes(asset.compressedSize)}`);
    } catch (error) {
      const message = describeStorageError(error, "替换图片");
      showImageMessage(message);
      setAppError(message);
    } finally {
      setImageProcessing(false);
    }
  }

  async function recompressImage(asset: ImageAsset) {
    if (asset.type === "image/gif") {
      showImageMessage("GIF 为保留动画不会重新压缩");
      return;
    }
    setImageProcessing(true);
    try {
      const result = await compressImageFile(
        asset.blob,
        asset.articleId,
        asset.name,
        { maxWidth: 960, quality: 0.74 },
        asset.id,
        asset.alt,
      );
      const optimized = { ...result, originalSize: asset.originalSize, createdAt: asset.createdAt };
      await putImageAsset(optimized);
      setImageAssets((items) => items.map((item) => (item.id === optimized.id ? optimized : item)));
      setAssetPreview(optimized);
      showImageMessage(`已节省空间：${formatBytes(asset.compressedSize)} → ${formatBytes(optimized.compressedSize)}`);
    } catch (error) {
      const message = describeStorageError(error, "重新压缩图片");
      showImageMessage(message);
      setAppError(message);
    } finally {
      setImageProcessing(false);
    }
  }

  function updateImageAlt(id: string, value: string) {
    const alt = value.replace(/[\]\r\n]/g, " ").slice(0, 120);
    setImageAssets((items) => items.map((asset) => (asset.id === id ? { ...asset, alt } : asset)));
    const pattern = new RegExp(`!\\[[^\\]]*\\]\\(asset:\\/\\/${escapeRegExp(id)}\\)`, "g");
    setMarkdown((content) => content.replace(pattern, () => `![${alt}](asset://${id})`));
  }

  async function saveImageAlt(id: string) {
    const asset = imageAssets.find((item) => item.id === id);
    if (!asset) return;
    try {
      await putImageAsset(asset);
      showImageMessage("图片说明已保存", 1600);
    } catch (error) {
      const message = describeStorageError(error, "保存图片说明");
      showImageMessage(message);
      setAppError(message);
    }
  }

  function insertExistingImage(asset: ImageAsset) {
    insertBlock(`![${asset.alt}](asset://${asset.id})`);
    showImageMessage(`已插入 ${asset.id}`, 1600);
  }

  async function removeImage(asset: ImageAsset) {
    if (!window.confirm(`确定删除图片 ${asset.id} 吗？正文中的对应引用也会被移除。`)) return;
    try {
      await deleteImageAsset(asset.id);
      const previewUrl = assetUrlsRef.current[asset.id];
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const nextUrls = { ...assetUrlsRef.current };
      delete nextUrls[asset.id];
      assetUrlsRef.current = nextUrls;
      setAssetUrls(nextUrls);
      setImageAssets((items) => items.filter((item) => item.id !== asset.id));
      const pattern = new RegExp(`\\n{0,2}!\\[[^\\]]*\\]\\(asset:\\/\\/${escapeRegExp(asset.id)}\\)\\n{0,2}`, "g");
      setMarkdown((content) => content.replace(pattern, "\n\n").replace(/\n{3,}/g, "\n\n"));
      showImageMessage("图片已删除", 1600);
    } catch (error) {
      const message = describeStorageError(error, "删除图片");
      showImageMessage(message);
      setAppError(message);
    }
  }

  function downloadImage(asset: ImageAsset) {
    const url = assetUrlsRef.current[asset.id] ?? URL.createObjectURL(asset.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = asset.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (!assetUrlsRef.current[asset.id]) URL.revokeObjectURL(url);
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const html = event.clipboardData.getData("text/html");
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!html.trim() && imageFiles.length) {
      event.preventDefault();
      void addImageFiles(imageFiles);
      return;
    }
    if (!html.trim()) return;
    const converted = convertPastedContent(html);
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
    setPasteMessage(
      `已清理${converted.source}格式并转换为 Markdown${converted.skippedImages ? `；${converted.skippedImages} 张本地图片需重新上传` : ""}`,
    );
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
      image: () => imageInputRef.current?.click(),
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
      const version: ArticleVersion = {
        id: crypto.randomUUID(),
        articleId: article.id,
        title: article.title,
        markdown: article.markdown,
        savedAt: new Date().toISOString(),
      };
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
        window.localStorage.setItem(articleStorageKeyV2, JSON.stringify(articles));
        setStorageError(false);
        setSaved("已保存");
      } catch (error) {
        setStorageError(true);
        setSaved("本地存储空间不足");
        setAppError(
          error instanceof DOMException && error.name === "QuotaExceededError"
            ? "手动保存失败：浏览器本地存储空间不足。请立即导出完整 ZIP 备份。"
            : "手动保存失败：无法写入浏览器本地存储。",
        );
      }
      return;
    }
    recordVersion(current);
    const updatedAt = new Date().toISOString();
    setArticles((items) =>
      items.map((item) => (item.id === activeId ? { ...item, title: title || "未命名文章", markdown, updatedAt } : item)),
    );
    setSaved(source === "自动保存" ? "已自动保存" : "已保存");
    window.setTimeout(() => setSaved("立即保存"), 1600);
  }

  function selectArticle(article: Article) {
    if (article.id === activeId) return;
    if (isDirty) persistCurrentArticle("自动保存");
    setActiveId(article.id);
    setTitle(article.title);
    setMarkdown(article.markdown);
    setSaved("立即保存");
  }

  function saveArticle() {
    persistCurrentArticle("手动保存");
  }

  function createArticle() {
    if (isDirty) persistCurrentArticle("自动保存");
    const article: Article = {
      id: crypto.randomUUID(),
      title: "未命名文章",
      markdown: "# 未命名文章\n\n开始写作...",
      updatedAt: new Date().toISOString(),
    };
    setArticles((items) => [article, ...items]);
    setActiveId(article.id);
    setTitle(article.title);
    setMarkdown(article.markdown);
    setSaved("立即保存");
  }

  function deleteArticle() {
    const current = articles.find((article) => article.id === activeId);
    if (!current || !window.confirm(`确定删除“${current.title || "未命名文章"}”吗？`)) return;
    const remaining = articles.filter((article) => article.id !== activeId);
    const remainingHistory = history.filter((version) => version.articleId !== activeId);
    const referencedIds = getReferencedAssetIds([
      ...remaining.map((article) => article.markdown),
      ...remainingHistory.map((version) => version.markdown),
    ]);
    void deleteUnusedImageAssets(referencedIds).catch((error) => setAppError(describeStorageError(error, "清理未使用图片")));
    setArticles(remaining);
    setHistory(remainingHistory);
    if (remaining.length) {
      setActiveId(remaining[0].id);
      setTitle(remaining[0].title);
      setMarkdown(remaining[0].markdown);
      setSaved("立即保存");
    } else {
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
      const article: Article = {
        id: crypto.randomUUID(),
        title: extractMarkdownTitle(content, file.name),
        markdown: content,
        updatedAt: new Date().toISOString(),
      };
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
    anchor.download = createMarkdownFilename(title);
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

  async function exportCompleteBackup() {
    setBackupMessage("正在打包…");
    setAppError("");
    try {
      const currentArticles = articles.map((article) =>
        article.id === activeId ? { ...article, title: title || "未命名文章", markdown, updatedAt: new Date().toISOString() } : article,
      );
      const assets = await getAllImageAssets();
      const bytes = await createCompleteBackup(
        {
          articles: currentArticles,
          history,
          assets,
          settings: { themeId, syncScroll, outlineOpen },
        },
        appVersion,
      );
      const url = URL.createObjectURL(new Blob([bytes.slice().buffer], { type: "application/zip" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = getBackupFilename();
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(url);
      setBackupMessage(`备份完成 · ${currentArticles.length} 篇 / ${assets.length} 张图`);
    } catch (error) {
      const message = error instanceof Error ? `完整备份失败：${error.message}` : "完整备份失败：无法读取本地数据";
      setBackupMessage("备份失败");
      setAppError(message);
    }
    window.setTimeout(() => setBackupMessage(""), 3200);
  }

  async function importCompleteBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBackupMessage("正在校验…");
    setAppError("");
    try {
      const restored = await readCompleteBackup(file);
      if (
        !window.confirm(
          `完整备份校验通过：\n\n• ${restored.articles.length} 篇文章\n• ${restored.history.length} 条历史版本\n• ${restored.assets.length} 张图片\n• 备份版本 V${restored.manifest.version}\n\n恢复将替换当前文章、历史和图片素材，是否继续？`,
        )
      ) {
        setBackupMessage("");
        return;
      }

      const previousAssets = await getAllImageAssets();
      let assetsReplaced = false;
      try {
        await replaceAllImageAssets(restored.assets);
        assetsReplaced = true;
        saveArticleData(window.localStorage, restored.articles, restored.history);
      } catch (error) {
        if (assetsReplaced) await replaceAllImageAssets(previousAssets).catch(() => undefined);
        throw error;
      }

      clearAutoSaveTimer();
      const first = restored.articles[0];
      setArticles(restored.articles);
      setHistory(restored.history);
      setActiveId(first.id);
      setTitle(first.title);
      setMarkdown(first.markdown);
      setThemeId(themes.some((item) => item.id === restored.settings.themeId) ? restored.settings.themeId : themes[0].id);
      setSyncScroll(restored.settings.syncScroll);
      setOutlineOpen(restored.settings.outlineOpen);
      setAssetRefreshKey((key) => key + 1);
      setStorageError(false);
      setSaved("完整备份已恢复");
      setBackupMessage(`恢复完成 · ${restored.articles.length} 篇 / ${restored.assets.length} 张图`);
    } catch (error) {
      const message = error instanceof Error ? `完整备份恢复失败：${error.message}` : "完整备份恢复失败";
      setBackupMessage("恢复失败");
      setAppError(message);
    }
    window.setTimeout(() => setBackupMessage(""), 4000);
  }

  async function importLibrary(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const imported = parseLegacyLibrary(JSON.parse(await file.text()));
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
    if (
      preflightErrors.length &&
      !window.confirm(
        `发布前检查发现 ${preflightErrors.length} 个必须处理的问题：\n\n${preflightErrors.map((issue) => `• ${issue.label}：${issue.detail}`).join("\n")}\n\n仍然复制正文吗？`,
      )
    )
      return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write)
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([copyHtml], { type: "text/html" }),
            "text/plain": new Blob([copyPlainText], { type: "text/plain" }),
          }),
        ]);
      else await navigator.clipboard.writeText(copyPlainText);
      setCopied("已复制正文");
    } catch {
      await navigator.clipboard.writeText(copyPlainText);
      setCopied("已复制文本");
    }
    if (localAssetReferences.length) {
      window.alert(
        `正文已复制。本文有 ${localAssetReferences.length} 张本地图片未嵌入正文，复制内容中已使用图片 ID 占位。\n\n请在公众号后台按 ID 上传图片，并删除对应占位块。压缩后的图片可在“图片素材”区域下载。`,
      );
    }
    window.setTimeout(() => setCopied("复制正文"), 1600);
  }

  async function copyPlainField(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setFieldCopied(key);
    window.setTimeout(() => setFieldCopied(null), 1400);
  }

  function exportHtml() {
    const exportHtmlContent = createExportHtml(title, bodyHtml, theme);
    const url = URL.createObjectURL(new Blob([exportHtmlContent], { type: "text/html;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "wechat-article.html";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  function printOrSavePdf() {
    const printOptions = { title, bodyHtml, theme };
    const opened = openPrintPreview(printOptions);
    if (!opened) window.alert("打印预览窗口被浏览器拦截。请允许本站打开弹出窗口后重试。");
  }

  return (
    <main className="workspace">
      <header className="topbar">
        <div>
          <p className="eyebrow">WeChat Formatter</p>
          <h1>公众号排版助手</h1>
        </div>
        <div className="topbarActions">
          <button
            className="ghostButton"
            type="button"
            title={hasUnsavedChanges ? "立即保存当前修改" : "当前内容已保存"}
            onClick={saveArticle}
          >
            {saved}
          </button>
          <button className="ghostButton" type="button" onClick={() => setHistoryOpen(true)} disabled={!activeId}>
            历史版本{currentHistory.length ? ` (${currentHistory.length})` : ""}
          </button>
          <button className="ghostButton" type="button" onClick={() => markdownFileInputRef.current?.click()}>
            {markdownMessage && markdownMessage !== "已导出" ? markdownMessage : "导入 .md"}
          </button>
          <button className="ghostButton" type="button" onClick={exportMarkdown} disabled={!activeId}>
            {markdownMessage === "已导出" ? "已导出" : "导出 .md"}
          </button>
          <button className="ghostButton" type="button" onClick={deleteArticle} disabled={!activeId}>
            删除文章
          </button>
          <button className="ghostButton" type="button" onClick={exportLibrary}>
            {libraryMessage || "导出 JSON"}
          </button>
          <button className="ghostButton" type="button" onClick={() => fileInputRef.current?.click()}>
            {libraryMessage || "导入 JSON"}
          </button>
          <button className="ghostButton" type="button" onClick={() => void exportCompleteBackup()}>
            {backupMessage || "完整备份 ZIP"}
          </button>
          <button className="ghostButton" type="button" onClick={() => backupInputRef.current?.click()}>
            恢复 ZIP
          </button>
          <button className="ghostButton" type="button" onClick={exportHtml}>
            导出 HTML
          </button>
          <button className="ghostButton" type="button" onClick={printOrSavePdf}>
            打印 / 保存 PDF
          </button>
          <button className="primaryButton" type="button" onClick={copyForWechat}>
            {copied}
          </button>
        </div>
        <input ref={fileInputRef} className="visuallyHidden" type="file" accept="application/json,.json" onChange={importLibrary} />
        <input ref={backupInputRef} className="visuallyHidden" type="file" accept="application/zip,.zip" onChange={importCompleteBackup} />
        <input
          ref={markdownFileInputRef}
          className="visuallyHidden"
          type="file"
          accept=".md,.markdown,text/markdown,text/plain"
          onChange={importMarkdown}
        />
        <input
          ref={imageInputRef}
          className="visuallyHidden"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          multiple
          onChange={handleImageInput}
        />
        <input
          ref={replaceImageInputRef}
          className="visuallyHidden"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={handleReplaceImage}
        />
      </header>

      {appError && (
        <div className="globalError" role="alert">
          <div>
            <strong>本地数据操作出现问题</strong>
            <span>{appError}</span>
          </div>
          <button type="button" aria-label="关闭错误提示" onClick={() => setAppError("")}>
            ×
          </button>
        </div>
      )}

      <section className="appGrid">
        <aside className="articleList" aria-label="文章列表">
          <div className="listHead">
            <div>
              <p className="panelKicker">草稿库</p>
              <h2>文章</h2>
            </div>
            <div className="articleListActions">
              <button className="addArticle" type="button" title="新建文章" onClick={createArticle}>
                +
              </button>
            </div>
          </div>
          <div className="articleItems">
            {articles.map((article) => (
              <button
                key={article.id}
                type="button"
                className={article.id === activeId ? "articleItem active" : "articleItem"}
                onClick={() => selectArticle(article)}
              >
                <strong>{article.title || "未命名文章"}</strong>
                <span>{getPlainText(article.markdown) || "暂无内容"}</span>
                <em>{formatUpdatedAt(article.updatedAt)}</em>
              </button>
            ))}
          </div>
        </aside>

        <section className={`editorPanel${dragActive ? " isDragging" : ""}`} aria-label="Markdown 编辑器">
          <div className="panelHead">
            <div>
              <p className="panelKicker">草稿</p>
              <h2>Markdown 编辑</h2>
            </div>
            <div className="panelHeadActions">
              <span className={`saveState${hasUnsavedChanges ? " dirty" : ""}`}>
                {storageError ? "⚠ 存储失败" : isDirty ? "● 未保存" : "✓ 已保存"}
              </span>
              <button
                className={`outlineToggle${outlineOpen ? " active" : ""}`}
                type="button"
                aria-expanded={outlineOpen}
                title="显示或收起当前文章大纲"
                onClick={() => setOutlineOpen((open) => !open)}
              >
                大纲 · {outlineOpen ? "开" : "关"}
              </button>
              <button
                className={`syncToggle${syncScroll ? " active" : ""}`}
                type="button"
                aria-pressed={syncScroll}
                title="编辑区与手机预览按阅读进度同步滚动"
                onClick={() => setSyncScroll((enabled) => !enabled)}
              >
                同步滚动 · {syncScroll ? "开" : "关"}
              </button>
              <div className="metricPill">{readMinutes} 分钟阅读</div>
            </div>
          </div>
          <div className={`editorWorkspace${outlineOpen ? "" : " outlineCollapsed"}`}>
            <aside className="outlinePanel editorOutline" aria-label="文章大纲">
              <div className="outlineHead">
                <div>
                  <p className="panelKicker">导航</p>
                  <h3>文章大纲</h3>
                </div>
                <div className="outlineMeta">
                  <span>{outline.length}</span>
                  <button type="button" title="收起文章大纲" aria-label="收起文章大纲" onClick={() => setOutlineOpen(false)}>
                    ×
                  </button>
                </div>
              </div>
              {outline.length ? (
                <nav className="outlineItems">
                  {outline.map((item, index) => (
                    <button
                      key={`${item.position}-${item.text}`}
                      className={activeOutlineIndex === index ? "active" : ""}
                      type="button"
                      style={{ paddingLeft: `${8 + Math.max(0, item.level - 1) * 10}px` }}
                      title={`第 ${item.line} 行 · H${item.level}`}
                      onClick={() => navigateToOutline(item, index)}
                    >
                      <span>H{item.level}</span>
                      <strong>{item.text}</strong>
                    </button>
                  ))}
                </nav>
              ) : (
                <p className="outlineEmpty">添加 Markdown 标题后，这里会生成可点击的大纲。</p>
              )}
            </aside>
            <div className="editorMain">
              <div className="titleFields">
                <label>
                  标题
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="填写文章标题" />
                </label>
              </div>
              <div className="toolbar" aria-label="排版工具">
                <button type="button" title="加粗" onClick={() => applyFormat("bold")}>
                  B
                </button>
                <button type="button" title="引用" onClick={() => applyFormat("quote")}>
                  “
                </button>
                <button type="button" title="无序列表" onClick={() => applyFormat("list")}>
                  列表
                </button>
                <button type="button" title="行内代码" onClick={() => applyFormat("inlineCode")}>
                  {"</>"}
                </button>
                <button type="button" title="代码块" onClick={() => applyFormat("codeBlock")}>
                  {"{ }"}
                </button>
                <button type="button" title="上传并压缩图片" disabled={imageProcessing} onClick={() => imageInputRef.current?.click()}>
                  {imageProcessing ? "处理中" : "图片"}
                </button>
                <div className="formatPicker" ref={formatRef}>
                  <button className="formatTrigger" type="button" aria-expanded={formatOpen} onClick={() => setFormatOpen((open) => !open)}>
                    格式 <span>⌄</span>
                  </button>
                  {formatOpen && (
                    <div className="formatMenu" role="menu">
                      {formatGroups.map((group) => (
                        <div className="formatGroup" key={group.label}>
                          <p>{group.label}</p>
                          {group.actions.map(([id, label]) => (
                            <button key={id} type="button" onClick={() => applyFormat(id)}>
                              {label}
                            </button>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              {(pasteMessage || imageMessage) && (
                <div className="pasteNotice" role="status">
                  {imageMessage || pasteMessage}
                </div>
              )}
              <textarea
                ref={textareaRef}
                className="markdownInput"
                value={markdown}
                onChange={(event) => {
                  setMarkdown(event.target.value);
                  updateOutlineFromEditor(event.currentTarget.selectionStart);
                }}
                onSelect={(event) => updateOutlineFromEditor(event.currentTarget.selectionStart)}
                onPaste={handleEditorPaste}
                onDragEnter={(event) => {
                  if (event.dataTransfer.types.includes("Files")) setDragActive(true);
                }}
                onDragOver={(event) => {
                  if (event.dataTransfer.types.includes("Files")) event.preventDefault();
                }}
                onDragLeave={() => setDragActive(false)}
                onDrop={handleEditorDrop}
                onScroll={(event) => syncScrollPosition(event.currentTarget, previewRef.current)}
                spellCheck={false}
              />
              <div className="editorStats">
                <span>{characterCount} 字</span>
                <span>{headingCount} 个小标题</span>
                <span>{imageCount} 张图片</span>
              </div>
              <section className="imageManager" aria-label="图片素材">
                <div className="imageManagerHead">
                  <div>
                    <h3>图片素材</h3>
                    <p>自动压缩后保存在本机；正文只记录图片 ID。</p>
                  </div>
                  <button type="button" disabled={imageProcessing || !activeId} onClick={() => imageInputRef.current?.click()}>
                    {imageProcessing ? "正在处理…" : "+ 添加图片"}
                  </button>
                </div>
                {imageAssets.length ? (
                  <div className="imageAssetList">
                    {imageAssets.map((asset) => (
                      <article className="imageAssetCard" key={asset.id}>
                        <img src={assetUrls[asset.id]} alt={asset.alt} />
                        <div className="imageAssetInfo">
                          <strong>{asset.id}</strong>
                          <span>
                            {asset.width} × {asset.height} · {formatBytes(asset.originalSize)} → {formatBytes(asset.compressedSize)}
                          </span>
                          <label>
                            图片说明
                            <input
                              value={asset.alt}
                              maxLength={120}
                              onChange={(event) => updateImageAlt(asset.id, event.target.value)}
                              onBlur={() => void saveImageAlt(asset.id)}
                            />
                          </label>
                          <div className="imageAssetActions">
                            <button type="button" onClick={() => insertExistingImage(asset)}>
                              插入
                            </button>
                            <button type="button" onClick={() => downloadImage(asset)}>
                              下载
                            </button>
                            <button type="button" disabled={imageProcessing} onClick={() => void recompressImage(asset)}>
                              节省空间
                            </button>
                            <button type="button" disabled={imageProcessing} onClick={() => beginReplaceImage(asset.id)}>
                              替换
                            </button>
                            <button className="danger" type="button" onClick={() => void removeImage(asset)}>
                              删除
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                ) : (
                  <button
                    className="imageDropEmpty"
                    type="button"
                    disabled={imageProcessing || !activeId}
                    onClick={() => imageInputRef.current?.click()}
                  >
                    粘贴、拖拽图片到编辑区，或点击选择图片
                    <br />
                    <span>支持 JPG、PNG、WebP、GIF，单张最大 25MB</span>
                  </button>
                )}
                <p className="imageStorageHint">
                  图片不会进入 JSON 或 .md 文件；请在更换设备前下载需要的图片。复制正文时会使用图片 ID 占位，不嵌入 Base64。
                </p>
              </section>
            </div>
          </div>
        </section>

        <section className="previewPanel" aria-label="公众号预览">
          <div className="phoneShell">
            <div className="phoneTop">
              <span>公众号</span>
              <span>{syncScroll ? "同步预览" : "预览"}</span>
            </div>
            <article
              ref={previewRef}
              className="wechatArticle"
              style={themeVars}
              onScroll={(event) => handlePreviewScroll(event.currentTarget)}
            >
              <header className="articleHeader">
                <h2>{title || "未命名文章"}</h2>
                <p>草稿</p>
              </header>
              <div className="articleBody" dangerouslySetInnerHTML={{ __html: bodyHtml }} />
            </article>
          </div>
        </section>

        <aside className="publishPanel" aria-label="发布设置">
          <div className="panelHead">
            <div>
              <p className="panelKicker">设置</p>
              <h2>发布准备</h2>
            </div>
          </div>
          <div className="sectionBlock">
            <h3>微信字段</h3>
            <div className="fieldCopyGrid">
              <button type="button" onClick={() => copyPlainField("title", title)}>
                {fieldCopied === "title" ? "已复制标题" : "复制标题"}
              </button>
            </div>
            <p className="fieldHint">标题需要单独粘贴到公众号后台；作者与封面由公众号后台自行填写和编辑。</p>
          </div>
          <div className="sectionBlock">
            <h3>定稿存档</h3>
            <div className="fieldCopyGrid">
              <button type="button" onClick={printOrSavePdf}>
                打印 / 保存 PDF
              </button>
            </div>
            <p className="fieldHint">打开独立的 A4 打印预览；可直接打印，或在系统打印对话框中选择“另存为 PDF”。</p>
          </div>
          <div className="sectionBlock">
            <h3>发布前检查</h3>
            <div className={`preflightSummary${preflightErrors.length ? " error" : preflightWarnings.length ? " warning" : " ready"}`}>
              <strong>
                {preflightErrors.length
                  ? `${preflightErrors.length} 个问题待处理`
                  : preflightWarnings.length
                    ? `${preflightWarnings.length} 项建议确认`
                    : "可以发布"}
              </strong>
              <span>
                {preflightPasses}/{preflightIssues.length} 项通过
              </span>
            </div>
            <div className="preflightList">
              {preflightIssues.map((issue) => (
                <article className={`preflightItem ${issue.status}`} key={issue.id}>
                  <span aria-hidden="true">{issue.status === "pass" ? "✓" : issue.status === "warning" ? "!" : "×"}</span>
                  <div>
                    <strong>{issue.label}</strong>
                    <p>{issue.detail}</p>
                  </div>
                </article>
              ))}
            </div>
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
          <div className="publishFooter">
            <button className="primaryButton wide" type="button" onClick={copyForWechat}>
              {copied}
            </button>
            {localAssetReferences.length > 0 && (
              <div className="assetPublishWarning">
                本文有 {localAssetReferences.length} 张本地图片。复制后请按图片 ID 在公众号后台重新上传。
              </div>
            )}
            <p>复制正文后粘贴到公众号编辑器，再填写标题、作者和封面。</p>
          </div>
        </aside>
      </section>

      {historyOpen && (
        <div className="historyOverlay" role="presentation" onClick={() => setHistoryOpen(false)}>
          <section
            className="historyDialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="history-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="historyHeader">
              <div>
                <p className="panelKicker">自动备份</p>
                <h2 id="history-title">历史版本</h2>
              </div>
              <button type="button" aria-label="关闭历史版本" onClick={() => setHistoryOpen(false)}>
                ×
              </button>
            </div>
            <p className="historyHint">每次自动或手动保存前保留旧内容，每篇文章最多保存 {maxVersionsPerArticle} 个版本。</p>
            <div className="historyList">
              {currentHistory.length ? (
                currentHistory.map((version) => (
                  <article className="historyItem" key={version.id}>
                    <div>
                      <strong>{formatVersionTime(version.savedAt)}</strong>
                      <span>{version.markdown.replace(/\s+/g, " ").slice(0, 90) || "空白内容"}</span>
                      <em>{getPlainText(version.markdown).replace(/\s/g, "").length} 字</em>
                    </div>
                    <button type="button" onClick={() => restoreVersion(version)}>
                      恢复此版本
                    </button>
                  </article>
                ))
              ) : (
                <div className="historyEmpty">还没有历史版本。编辑内容并等待自动保存后，这里会出现可恢复版本。</div>
              )}
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
