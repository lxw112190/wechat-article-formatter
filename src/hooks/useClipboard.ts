import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent, Dispatch, SetStateAction } from "react";
import { detectPasteContent } from "../markdown/pasteDetector";
import { convertPastedHtml } from "../markdown/pasteConverter";
import type { PreflightIssue } from "../types";

type UseClipboardOptions = {
  markdown: string;
  setMarkdown: Dispatch<SetStateAction<string>>;
  copyHtml: string;
  copyPlainText: string;
  preflightErrors: PreflightIssue[];
  localImageCount: number;
  addImageFiles: (files: File[]) => Promise<void>;
};

export function useClipboard({
  markdown,
  setMarkdown,
  copyHtml,
  copyPlainText,
  preflightErrors,
  localImageCount,
  addImageFiles,
}: UseClipboardOptions) {
  const pasteTimerRef = useRef<number | null>(null);
  const [copied, setCopied] = useState("复制正文");
  const [fieldCopied, setFieldCopied] = useState<string | null>(null);
  const [pasteMessage, setPasteMessage] = useState("");

  useEffect(
    () => () => {
      if (pasteTimerRef.current) window.clearTimeout(pasteTimerRef.current);
    },
    [],
  );

  function clearPasteMessage() {
    if (pasteTimerRef.current) {
      window.clearTimeout(pasteTimerRef.current);
      pasteTimerRef.current = null;
    }
    setPasteMessage("");
  }

  function showPasteMessage(message: string) {
    if (pasteTimerRef.current) window.clearTimeout(pasteTimerRef.current);
    setPasteMessage(message);
    pasteTimerRef.current = window.setTimeout(() => {
      setPasteMessage("");
      pasteTimerRef.current = null;
    }, 3600);
  }

  function insertConvertedContent(textarea: HTMLTextAreaElement, content: string) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const multiline = content.includes("\n");
    const leading = multiline && start > 0 && markdown[start - 1] !== "\n" ? "\n\n" : "";
    const trailing = multiline && end < markdown.length && markdown[end] !== "\n" ? "\n\n" : "";
    const insertion = `${leading}${content}${trailing}`;
    setMarkdown(`${markdown.slice(0, start)}${insertion}${markdown.slice(end)}`);
    requestAnimationFrame(() => {
      textarea.focus();
      const position = start + insertion.length - trailing.length;
      textarea.selectionStart = position;
      textarea.selectionEnd = position;
    });
  }

  async function copyForWechat() {
    if (
      preflightErrors.length &&
      !window.confirm(
        `发布前检查发现 ${preflightErrors.length} 个必须处理的问题：\n\n${preflightErrors
          .map((issue) => `• ${issue.label}：${issue.detail}`)
          .join("\n")}\n\n仍然复制正文吗？`,
      )
    )
      return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([copyHtml], { type: "text/html" }),
            "text/plain": new Blob([copyPlainText], { type: "text/plain" }),
          }),
        ]);
      } else {
        await navigator.clipboard.writeText(copyPlainText);
      }
      setCopied("已复制正文");
    } catch {
      await navigator.clipboard.writeText(copyPlainText);
      setCopied("已复制文本");
    }
    if (localImageCount) {
      window.alert(
        `正文已复制。本文有 ${localImageCount} 张本地图片未嵌入正文，复制内容中已使用图片 ID 占位。\n\n请在公众号后台按 ID 上传图片，并删除对应占位块。压缩后的图片可在“图片素材”区域下载。`,
      );
    }
    window.setTimeout(() => setCopied("复制正文"), 1600);
  }

  async function copyPlainField(key: string, value: string) {
    await navigator.clipboard.writeText(value);
    setFieldCopied(key);
    window.setTimeout(() => setFieldCopied(null), 1400);
  }

  function handleEditorPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const plainText = event.clipboardData.getData("text/plain");
    const html = event.clipboardData.getData("text/html");
    const imageFiles = Array.from(event.clipboardData.items)
      .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((file): file is File => Boolean(file));
    if (!plainText.trim() && !html.trim() && imageFiles.length) {
      event.preventDefault();
      clearPasteMessage();
      void addImageFiles(imageFiles);
      return;
    }

    const detection = detectPasteContent(plainText, html);
    if (detection.type === "markdown" || detection.type === "plain-text") {
      clearPasteMessage();
      return;
    }

    const converted = convertPastedHtml(html);
    const content = converted.markdown || plainText;
    if (!content) return;

    event.preventDefault();
    insertConvertedContent(event.currentTarget, content);
    const prefix = detection.type === "word" ? "已将 Word 内容转换为 Markdown" : "检测到富文本，已转换为 Markdown";
    showPasteMessage(`${prefix}${converted.skippedImages ? `；${converted.skippedImages} 张本地图片需重新上传` : ""}`);
  }

  return { copied, fieldCopied, pasteMessage, copyForWechat, copyPlainField, handleEditorPaste };
}
