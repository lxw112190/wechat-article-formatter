import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { OutlineItem } from "../types";

type UseSyncScrollOptions = {
  markdown: string;
  outline: OutlineItem[];
  textareaRef: RefObject<HTMLTextAreaElement | null>;
};

export function useSyncScroll({ markdown, outline, textareaRef }: UseSyncScrollOptions) {
  const previewRef = useRef<HTMLElement>(null);
  const syncTargetRef = useRef<HTMLElement | null>(null);
  const outlineNavigationRef = useRef(false);
  const [activeOutlineIndex, setActiveOutlineIndex] = useState(0);
  const [outlineOpen, setOutlineOpen] = useState(() => window.localStorage.getItem("wechat-editor-outline") !== "false");
  const [syncScroll, setSyncScroll] = useState(() => window.localStorage.getItem("wechat-sync-scroll") !== "false");

  const syncScrollPosition = useCallback(
    (source: HTMLElement | null, target: HTMLElement | null) => {
      if (!syncScroll || outlineNavigationRef.current || !source || !target || syncTargetRef.current === source) return;
      const sourceRange = source.scrollHeight - source.clientHeight;
      const targetRange = target.scrollHeight - target.clientHeight;
      const progress = sourceRange > 0 ? source.scrollTop / sourceRange : 0;
      syncTargetRef.current = target;
      target.scrollTop = progress * Math.max(0, targetRange);
      requestAnimationFrame(() => {
        if (syncTargetRef.current === target) syncTargetRef.current = null;
      });
    },
    [syncScroll],
  );

  useEffect(() => {
    window.localStorage.setItem("wechat-sync-scroll", String(syncScroll));
    if (syncScroll) requestAnimationFrame(() => syncScrollPosition(textareaRef.current, previewRef.current));
  }, [syncScroll, syncScrollPosition, textareaRef]);

  useEffect(() => {
    window.localStorage.setItem("wechat-editor-outline", String(outlineOpen));
  }, [outlineOpen]);

  useEffect(() => {
    setActiveOutlineIndex((index) => Math.min(index, Math.max(0, outline.length - 1)));
  }, [outline]);

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

  return {
    previewRef,
    activeOutlineIndex,
    outlineOpen,
    syncScroll,
    setOutlineOpen,
    setSyncScroll,
    syncScrollPosition,
    updateOutlineFromEditor,
    handlePreviewScroll,
    navigateToOutline,
  };
}
