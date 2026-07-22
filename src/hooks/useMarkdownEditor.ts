import { useEffect, useRef, useState } from "react";
import type { Dispatch, SetStateAction } from "react";

export const formatGroups = [
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

type UseMarkdownEditorOptions = {
  markdown: string;
  setMarkdown: Dispatch<SetStateAction<string>>;
};

export function useMarkdownEditor({ markdown, setMarkdown }: UseMarkdownEditorOptions) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const replaceImageInputRef = useRef<HTMLInputElement>(null);
  const formatRef = useRef<HTMLDivElement>(null);
  const [formatOpen, setFormatOpen] = useState(false);
  const [dragActive, setDragActive] = useState(false);

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

  return {
    textareaRef,
    imageInputRef,
    replaceImageInputRef,
    formatRef,
    formatOpen,
    dragActive,
    setFormatOpen,
    setDragActive,
    insertBlock,
    applyFormat,
  };
}
