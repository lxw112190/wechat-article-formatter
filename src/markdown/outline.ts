import type { OutlineItem } from "../types";

function cleanHeadingText(value: string) {
  return value
    .replace(/\s+#+\s*$/, "")
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[*_~`]/g, "")
    .replace(/<[^>]+>/g, "")
    .trim();
}

export function getMarkdownOutline(markdown: string) {
  const outline: OutlineItem[] = [];
  const rows = markdown.match(/[^\n]*(?:\n|$)/g)?.filter((row, index, items) => row.length || index < items.length - 1) ?? [];
  let offset = 0;
  let fence: { marker: string; length: number } | null = null;

  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    const line = raw.replace(/\r?\n$/, "");
    const fenceMatch = line.match(/^ {0,3}(`{3,}|~{3,})/);
    if (fenceMatch) {
      const marker = fenceMatch[1][0];
      if (!fence) fence = { marker, length: fenceMatch[1].length };
      else if (fence.marker === marker && fenceMatch[1].length >= fence.length) fence = null;
      offset += raw.length;
      continue;
    }
    if (fence) {
      offset += raw.length;
      continue;
    }

    const atx = line.match(/^ {0,3}(#{1,6})\s+(.+?)\s*$/);
    if (atx) {
      const text = cleanHeadingText(atx[2]);
      if (text) outline.push({ level: atx[1].length, text, position: offset, line: index + 1 });
      offset += raw.length;
      continue;
    }

    const nextLine = rows[index + 1]?.replace(/\r?\n$/, "") ?? "";
    const setext = line.trim() && nextLine.match(/^ {0,3}(=+|-+)\s*$/);
    if (setext) {
      const text = cleanHeadingText(line.trim());
      if (text) outline.push({ level: setext[1][0] === "=" ? 1 : 2, text, position: offset, line: index + 1 });
    }
    offset += raw.length;
  }
  return outline;
}
