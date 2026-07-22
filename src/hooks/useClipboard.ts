import { useEffect, useRef, useState } from "react";
import type { ClipboardEvent as ReactClipboardEvent, Dispatch, SetStateAction } from "react";
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

    if (pasteTimerRef.current) window.clearTimeout(pasteTimerRef.current);
    setPasteMessage(
      `已清理${converted.source}格式并转换为 Markdown${converted.skippedImages ? `；${converted.skippedImages} 张本地图片需重新上传` : ""}`,
    );
    pasteTimerRef.current = window.setTimeout(() => {
      setPasteMessage("");
      pasteTimerRef.current = null;
    }, 3600);
  }

  return { copied, fieldCopied, pasteMessage, copyForWechat, copyPlainField, handleEditorPaste };
}
