import { normalizeCodeLanguage, type CodeLanguage } from "./codeLanguages";

export type CodeBlockRange = {
  start: number;
  end: number;
  contentStart: number;
  contentEnd: number;
  language: CodeLanguage | null;
  rawLanguage: string;
  code: string;
};

export function findCodeBlockAtPosition(markdown: string, position: number): CodeBlockRange | null {
  const lines = markdown.split(/\r?\n/);
  let offset = 0;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    const opening = line.match(/^(\s*)(`{3,}|~{3,})\s*([^\s]*)?.*$/);
    if (!opening) {
      offset += line.length + 1;
      continue;
    }
    const start = offset;
    const contentStart = offset + line.length + (index < lines.length - 1 ? 1 : 0);
    let cursor = contentStart;
    for (let closeIndex = index + 1; closeIndex < lines.length; closeIndex += 1) {
      const closeLine = lines[closeIndex];
      const closing = closeLine.match(/^\s*(`{3,}|~{3,})\s*$/);
      if (!closing || closing[1][0] !== opening[2][0] || closing[1].length < opening[2].length) {
        cursor += closeLine.length + 1;
        continue;
      }
      const closingStart = cursor;
      const end = closingStart + closeLine.length;
      if (position >= start && position <= end) {
        const rawLanguage = opening[3]?.trim() ?? "";
        return {
          start,
          end,
          contentStart,
          contentEnd: closingStart,
          language: normalizeCodeLanguage(rawLanguage),
          rawLanguage,
          code: markdown.slice(contentStart, closingStart).replace(/\r?\n$/, ""),
        };
      }
      index = closeIndex;
      offset = end + 1;
      break;
    }
  }
  return null;
}

export function ensureBlockSeparation(markdown: string, start: number, end: number, content: string) {
  const safeStart = Math.max(0, Math.min(start, markdown.length));
  const safeEnd = Math.max(safeStart, Math.min(end, markdown.length));
  const before = safeStart > 0 && markdown[safeStart - 1] !== "\n" ? "\n\n" : "";
  const after = safeEnd < markdown.length && markdown[safeEnd] !== "\n" ? "\n\n" : "";
  const replacement = `${before}${content}${after}`;
  return {
    markdown: `${markdown.slice(0, safeStart)}${replacement}${markdown.slice(safeEnd)}`,
    caret: safeStart + replacement.length - after.length,
  };
}
