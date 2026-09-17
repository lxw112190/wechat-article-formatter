import {
  AlignmentType,
  Bookmark,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
  InternalHyperlink,
  LevelFormat,
  LineRuleType,
  PageNumber,
  Packer,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  UnderlineType,
  WidthType,
} from "docx";
import type { Theme } from "../types";

export type ExportWordOptions = {
  title: string;
  bodyHtml: string;
  theme: Theme;
  settings?: WordExportSettings;
};

export type WordExportSettings = {
  pageSize: "a4" | "a5";
  marginTop: number;
  marginRight: number;
  marginBottom: number;
  marginLeft: number;
  showTitle: boolean;
  removeDuplicateTitle: boolean;
  includeToc: boolean;
  tocDepth: 1 | 2 | 3;
  showFooterTitle: boolean;
  showPageNumbers: boolean;
  fontFamily: "theme" | "microsoft-yahei" | "simsun" | "kaiti" | "fangsong";
  bodyFontSize: number | null;
  lineHeight: number | null;
  imageMaxWidth: number;
};

export type WordExportPreset = "wechat" | "formal" | "compact";

const wordSettingsStorageKey = "wechat-word-export-settings-v1";

export const defaultWordExportSettings: WordExportSettings = {
  pageSize: "a4",
  marginTop: 19,
  marginRight: 22,
  marginBottom: 19,
  marginLeft: 22,
  showTitle: true,
  removeDuplicateTitle: true,
  includeToc: false,
  tocDepth: 3,
  showFooterTitle: true,
  showPageNumbers: true,
  fontFamily: "theme",
  bodyFontSize: null,
  lineHeight: null,
  imageMaxWidth: 560,
};

export function getWordExportPreset(preset: WordExportPreset): WordExportSettings {
  if (preset === "formal") {
    return {
      ...defaultWordExportSettings,
      marginTop: 25,
      marginRight: 26,
      marginBottom: 24,
      marginLeft: 26,
      includeToc: true,
      fontFamily: "simsun",
      bodyFontSize: 12,
      lineHeight: 1.7,
      imageMaxWidth: 520,
    };
  }
  if (preset === "compact") {
    return {
      ...defaultWordExportSettings,
      marginTop: 15,
      marginRight: 16,
      marginBottom: 15,
      marginLeft: 16,
      showFooterTitle: false,
      bodyFontSize: 10.5,
      lineHeight: 1.45,
      imageMaxWidth: 600,
    };
  }
  return { ...defaultWordExportSettings };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function clampNumber(value: unknown, fallback: number, min: number, max: number) {
  return typeof value === "number" && Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}

export function normalizeWordExportSettings(value: unknown): WordExportSettings {
  if (!isRecord(value)) return { ...defaultWordExportSettings };
  const fontFamilies = ["theme", "microsoft-yahei", "simsun", "kaiti", "fangsong"] as const;
  const bodySize = value.bodyFontSize == null ? null : clampNumber(value.bodyFontSize, 12, 9, 20);
  const lineHeight = value.lineHeight == null ? null : clampNumber(value.lineHeight, 1.7, 1.2, 2.5);
  return {
    pageSize: value.pageSize === "a5" ? "a5" : "a4",
    marginTop: clampNumber(value.marginTop, defaultWordExportSettings.marginTop, 8, 40),
    marginRight: clampNumber(value.marginRight, defaultWordExportSettings.marginRight, 8, 40),
    marginBottom: clampNumber(value.marginBottom, defaultWordExportSettings.marginBottom, 8, 40),
    marginLeft: clampNumber(value.marginLeft, defaultWordExportSettings.marginLeft, 8, 40),
    showTitle: typeof value.showTitle === "boolean" ? value.showTitle : defaultWordExportSettings.showTitle,
    removeDuplicateTitle:
      typeof value.removeDuplicateTitle === "boolean" ? value.removeDuplicateTitle : defaultWordExportSettings.removeDuplicateTitle,
    includeToc: typeof value.includeToc === "boolean" ? value.includeToc : defaultWordExportSettings.includeToc,
    tocDepth: value.tocDepth === 1 || value.tocDepth === 2 ? value.tocDepth : 3,
    showFooterTitle: typeof value.showFooterTitle === "boolean" ? value.showFooterTitle : defaultWordExportSettings.showFooterTitle,
    showPageNumbers: typeof value.showPageNumbers === "boolean" ? value.showPageNumbers : defaultWordExportSettings.showPageNumbers,
    fontFamily: fontFamilies.includes(value.fontFamily as (typeof fontFamilies)[number])
      ? (value.fontFamily as WordExportSettings["fontFamily"])
      : "theme",
    bodyFontSize: bodySize,
    lineHeight,
    imageMaxWidth: clampNumber(value.imageMaxWidth, defaultWordExportSettings.imageMaxWidth, 280, 680),
  };
}

export function loadWordExportSettings(storage: Pick<Storage, "getItem">) {
  try {
    const raw = storage.getItem(wordSettingsStorageKey);
    return raw ? normalizeWordExportSettings(JSON.parse(raw)) : { ...defaultWordExportSettings };
  } catch {
    return { ...defaultWordExportSettings };
  }
}

export function saveWordExportSettings(storage: Pick<Storage, "setItem">, settings: WordExportSettings) {
  storage.setItem(wordSettingsStorageKey, JSON.stringify(normalizeWordExportSettings(settings)));
}

type InlineStyle = {
  bold?: boolean;
  italics?: boolean;
  strike?: boolean;
  font?: string;
  color?: string;
  size?: number;
  underline?: boolean;
  shading?: string;
};

type WordChild = TextRun | ImageRun | ExternalHyperlink | InternalHyperlink | Bookmark;
type HeadingKey = keyof Theme["headings"];
type HeadingEntry = { id: string; level: number; text: string };

const headingLevels = [
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
  HeadingLevel.HEADING_6,
];

const cleanColor = (color: string) => color.replace("#", "").toUpperCase();
const pxToHalfPoints = (pixels: number) => Math.max(16, Math.round(pixels * 1.5));
const pxToTwips = (pixels: number) => Math.max(0, Math.round(pixels * 15));
const mmToTwips = (millimeters: number) => Math.round(millimeters * 56.6929);
const bodyLineSpacing = (theme: Theme) => Math.round(theme.bodyLineHeight * 240);

function pageLayout(settings: WordExportSettings) {
  const page = settings.pageSize === "a5" ? { width: 8391, height: 11906 } : { width: 11906, height: 16838 };
  const margins = {
    top: mmToTwips(settings.marginTop),
    right: mmToTwips(settings.marginRight),
    bottom: mmToTwips(settings.marginBottom),
    left: mmToTwips(settings.marginLeft),
    header: 500,
    footer: 500,
    gutter: 0,
  };
  return { ...page, margins, contentWidth: page.width - margins.left - margins.right };
}

function addUrlBreakOpportunities(value: string) {
  return value.replace(/([/?#&=._-])/g, "$1\u200b");
}

function applyWordSettingsToTheme(theme: Theme, settings: WordExportSettings): Theme {
  const fontMap: Record<Exclude<WordExportSettings["fontFamily"], "theme">, Theme["fontFamily"]> = {
    "microsoft-yahei": "microsoft-yahei",
    simsun: "songti",
    kaiti: "kaiti",
    fangsong: "fangsong",
  };
  return {
    ...theme,
    fontFamily: settings.fontFamily === "theme" ? theme.fontFamily : fontMap[settings.fontFamily],
    bodyFontSize: settings.bodyFontSize === null ? theme.bodyFontSize : settings.bodyFontSize / 0.75,
    bodyLineHeight: settings.lineHeight ?? theme.bodyLineHeight,
  };
}

function wordAlignment(alignment: string) {
  if (alignment === "center") return AlignmentType.CENTER;
  if (alignment === "right") return AlignmentType.RIGHT;
  if (alignment === "justify") return AlignmentType.JUSTIFIED;
  return AlignmentType.LEFT;
}

export function getWordFontName(theme: Theme) {
  const names: Record<Theme["fontFamily"], string> = {
    system: "Microsoft YaHei",
    "microsoft-yahei": "Microsoft YaHei",
    pingfang: "PingFang SC",
    "noto-sans": "Noto Sans SC",
    serif: "SimSun",
    songti: "SimSun",
    kaiti: "KaiTi",
    fangsong: "FangSong",
    rounded: "Microsoft YaHei",
    arial: "Arial",
  };
  return names[theme.fontFamily];
}

export function sanitizeFileName(title: string) {
  const safe = title
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/[. ]+$/g, "")
    .slice(0, 100);
  return safe || "wechat-article";
}

export function fitImageSize(width: number, height: number, maxWidth = 560) {
  const safeWidth = Number.isFinite(width) && width > 0 ? width : maxWidth;
  const safeHeight = Number.isFinite(height) && height > 0 ? height : Math.round(maxWidth * 0.56);
  if (safeWidth <= maxWidth) return { width: Math.round(safeWidth), height: Math.round(safeHeight) };
  return { width: maxWidth, height: Math.max(1, Math.round((safeHeight * maxWidth) / safeWidth)) };
}

function toImageType(blob: Blob, src: string): "jpg" | "png" | "gif" | null {
  if (blob.type === "image/png" || /\.png(?:\?|$)/i.test(src)) return "png";
  if (blob.type === "image/gif" || /\.gif(?:\?|$)/i.test(src)) return "gif";
  if (blob.type === "image/jpeg" || blob.type === "image/jpg" || /\.(?:jpe?g)(?:\?|$)/i.test(src)) return "jpg";
  return null;
}

async function convertImageBlobToPng(blob: Blob) {
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("图片解码失败"));
      image.src = url;
    });
    const width = image.naturalWidth || image.width;
    const height = image.naturalHeight || image.height;
    if (!width || !height) return null;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(image, 0, 0, width, height);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    return png ? { blob: png, width, height } : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function loadImageRun(image: HTMLImageElement, maxWidth: number) {
  const src = image.currentSrc || image.src;
  if (!src) return null;
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    let blob = await response.blob();
    let type = toImageType(blob, src);
    let convertedSize: { width: number; height: number } | null = null;
    if (!type && (blob.type === "image/webp" || blob.type === "image/svg+xml" || /\.(?:webp|svg)(?:\?|$)/i.test(src))) {
      const converted = await convertImageBlobToPng(blob);
      if (converted) {
        blob = converted.blob;
        type = "png";
        convertedSize = converted;
      }
    }
    if (!type) return null;
    const width = Number(image.getAttribute("width")) || image.naturalWidth || convertedSize?.width || maxWidth;
    const height = Number(image.getAttribute("height")) || image.naturalHeight || convertedSize?.height || Math.round(width * 0.56);
    const alt = image.alt || "文章图片";
    return new ImageRun({
      type,
      data: new Uint8Array(await blob.arrayBuffer()),
      transformation: fitImageSize(width, height, maxWidth),
      altText: { title: alt, description: alt, name: alt },
    });
  } catch {
    return null;
  }
}

function textRun(text: string, theme: Theme, style: InlineStyle = {}) {
  return new TextRun({
    text,
    bold: style.bold,
    italics: style.italics,
    strike: style.strike,
    font: style.font ?? getWordFontName(theme),
    color: style.color ?? cleanColor(theme.text),
    size: style.size ?? pxToHalfPoints(theme.bodyFontSize),
    underline: style.underline ? { type: UnderlineType.SINGLE, color: style.color ?? cleanColor(theme.accent) } : undefined,
    shading: style.shading ? { type: ShadingType.CLEAR, color: "auto", fill: style.shading } : undefined,
  });
}

function textRuns(text: string, theme: Theme, style: InlineStyle = {}): TextRun[] {
  const parts = text.replace(/\r\n?/g, "\n").split("\n");
  return parts.flatMap((part, index) =>
    index ? [new TextRun({ break: 1 }), ...(part ? [textRun(part, theme, style)] : [])] : part ? [textRun(part, theme, style)] : [],
  );
}

function colorFromElement(element: HTMLElement) {
  const value = element.style.color.trim();
  return value ? cleanColor(value) : undefined;
}

async function inlineChildren(
  node: Node,
  theme: Theme,
  style: InlineStyle = {},
  settings: WordExportSettings = defaultWordExportSettings,
): Promise<WordChild[]> {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? textRuns(node.textContent, theme, style) : [];
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [new TextRun({ break: 1 })];
  if (node.tagName === "IMG") {
    const run = await loadImageRun(node as HTMLImageElement, settings.imageMaxWidth);
    if (run) return [run];
    const image = node as HTMLImageElement;
    return [textRun(`【图片：${image.alt || "未加载"}】${image.src ? ` 原图：${image.src}` : ""}`, theme, style)];
  }
  if (node.tagName === "A") {
    const linkStyle = { ...style, color: cleanColor(theme.accent), underline: true };
    const href = node.getAttribute("href")?.trim();
    const label = node.textContent?.trim() ?? "";
    const children =
      href && /^https?:\/\//i.test(label) && label === href
        ? [textRun(addUrlBreakOpportunities(label), theme, linkStyle)]
        : (await Promise.all(Array.from(node.childNodes).map((child) => inlineChildren(child, theme, linkStyle, settings)))).flat();
    return href ? [new ExternalHyperlink({ link: href, children })] : children;
  }
  const isInlineCode = node.tagName === "CODE";
  const nextStyle: InlineStyle = {
    ...style,
    bold: style.bold || node.tagName === "STRONG" || node.tagName === "B",
    italics: style.italics || node.tagName === "EM" || node.tagName === "I",
    strike: style.strike || node.tagName === "DEL" || node.tagName === "S",
    font: isInlineCode || node.tagName === "PRE" ? "Consolas" : style.font,
    color: style.color ?? (isInlineCode ? cleanColor(theme.heading) : colorFromElement(node)),
    shading: isInlineCode ? cleanColor(theme.codeBg) : style.shading,
  };
  return (await Promise.all(Array.from(node.childNodes).map((child) => inlineChildren(child, theme, nextStyle, settings)))).flat();
}

function headingPresentation(theme: Theme, level: number) {
  const config = theme.headings[`h${level + 1}` as HeadingKey];
  const border: Record<string, { style: (typeof BorderStyle)[keyof typeof BorderStyle]; size: number; color: string; space?: number }> = {};
  let shading: { type: (typeof ShadingType)[keyof typeof ShadingType]; color: string; fill: string } | undefined;
  let indent: { left?: number; right?: number } | undefined;
  if (config.decoration === "left-bar") {
    border.left = { style: BorderStyle.SINGLE, size: 22, color: cleanColor(theme.accent), space: 8 };
    indent = { left: 150 };
  } else if (config.decoration === "underline") {
    border.bottom = { style: BorderStyle.SINGLE, size: 8, color: cleanColor(theme.accent), space: 6 };
  } else if (config.decoration === "filled" || config.decoration === "pill") {
    shading = { type: ShadingType.CLEAR, color: "auto", fill: cleanColor(theme.accentSoft) };
    for (const side of ["top", "bottom", "left", "right"]) {
      border[side] = { style: BorderStyle.SINGLE, size: 2, color: cleanColor(theme.border) };
    }
    indent = { left: 140, right: 140 };
  }
  return { config, alignment: wordAlignment(config.align), border: Object.keys(border).length ? border : undefined, shading, indent };
}

async function paragraphFromNode(
  node: Element,
  theme: Theme,
  settings: WordExportSettings,
  options: {
    headingLevel?: number;
    level?: number;
    bullet?: boolean;
    numbering?: boolean;
    style?: InlineStyle;
    compact?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bookmarkId?: string;
  } = {},
) {
  const heading = options.headingLevel === undefined ? undefined : headingLevels[options.headingLevel];
  const headingStyle = options.headingLevel === undefined ? undefined : headingPresentation(theme, options.headingLevel);
  const baseStyle: InlineStyle = headingStyle
    ? { bold: true, color: cleanColor(headingStyle.config.color), size: pxToHalfPoints(headingStyle.config.fontSize) }
    : (options.style ?? {});
  const children: WordChild[] = [];
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes((child as Element).tagName)) continue;
    if (child.nodeType === Node.ELEMENT_NODE && (child as Element).tagName === "INPUT") {
      children.push(textRun((child as HTMLInputElement).checked ? "☑ " : "☐ ", theme, baseStyle));
      continue;
    }
    children.push(...(await inlineChildren(child, theme, baseStyle, settings)));
  }
  const paragraphChildren = children.length ? children : [textRun("", theme, baseStyle)];
  return new Paragraph({
    children: options.bookmarkId ? [new Bookmark({ id: options.bookmarkId, children: paragraphChildren })] : paragraphChildren,
    heading,
    alignment: headingStyle?.alignment ?? options.alignment ?? wordAlignment(theme.bodyTextAlign),
    bullet: options.bullet ? { level: Math.min(options.level ?? 0, 7) } : undefined,
    numbering: options.numbering ? { reference: "word-ordered", level: Math.min(options.level ?? 0, 7) } : undefined,
    indent:
      headingStyle?.indent ??
      (options.level !== undefined
        ? { left: 420 + Math.min(options.level, 7) * 420, hanging: 240 }
        : theme.firstLineIndent > 0
          ? { firstLine: pxToTwips(theme.firstLineIndent * theme.bodyFontSize) }
          : undefined),
    spacing: headingStyle
      ? { before: options.headingLevel === 0 ? 420 : 300, after: 160, line: 300, lineRule: LineRuleType.AUTO }
      : {
          after: options.compact ? 80 : pxToTwips(theme.paragraphSpacing),
          line: bodyLineSpacing(theme),
          lineRule: LineRuleType.AUTO,
        },
    shading: headingStyle?.shading,
    border: headingStyle?.border,
    keepNext: Boolean(headingStyle),
    keepLines: Boolean(headingStyle),
    widowControl: true,
    wordWrap: true,
    overflowPunctuation: true,
    autoSpaceEastAsianText: true,
  });
}

async function listParagraphs(
  list: HTMLUListElement | HTMLOListElement,
  theme: Theme,
  settings: WordExportSettings,
  level = 0,
): Promise<Paragraph[]> {
  const ordered = list.tagName === "OL";
  const paragraphs: Paragraph[] = [];
  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLLIElement)) continue;
    paragraphs.push(await paragraphFromNode(child, theme, settings, { level, bullet: !ordered, numbering: ordered, compact: true }));
    for (const nested of Array.from(child.children)) {
      if (nested.tagName === "UL" || nested.tagName === "OL")
        paragraphs.push(...(await listParagraphs(nested as HTMLUListElement | HTMLOListElement, theme, settings, level + 1)));
    }
  }
  if (paragraphs.length) paragraphs.push(new Paragraph({ spacing: { after: Math.max(60, pxToTwips(theme.listSpacing)) } }));
  return paragraphs;
}

async function tableFromNode(table: HTMLTableElement, theme: Theme, settings: WordExportSettings) {
  const rows: TableRow[] = [];
  const sourceRows = Array.from(table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr"));
  const columnCount = Math.max(
    1,
    ...sourceRows.map((row) =>
      Array.from(row.children).reduce((count, cell) => count + Math.max(1, Number(cell.getAttribute("colspan")) || 1), 0),
    ),
  );
  for (const [rowIndex, row] of sourceRows.entries()) {
    const cells: TableCell[] = [];
    for (const cell of Array.from(row.children)) {
      if (!(cell instanceof HTMLTableCellElement)) continue;
      const isHeader = cell.tagName === "TH";
      const cellStyle: InlineStyle = {
        bold: isHeader,
        color: cleanColor(isHeader && theme.tableStyle === "accent-header" ? "#ffffff" : theme.text),
        size: Math.max(18, pxToHalfPoints(theme.bodyFontSize) - 1),
      };
      const children = cell.querySelectorAll(":scope > p").length
        ? await Promise.all(
            Array.from(cell.querySelectorAll(":scope > p")).map((paragraph) =>
              paragraphFromNode(paragraph, theme, settings, { style: cellStyle, compact: true }),
            ),
          )
        : [await paragraphFromNode(cell, theme, settings, { style: cellStyle, compact: true })];
      const headerFill = theme.tableStyle === "accent-header" ? cleanColor(theme.accent) : cleanColor(theme.accentSoft);
      const stripeFill = rowIndex > 0 && rowIndex % 2 === 0 && theme.tableStyle !== "minimal" ? "F8FAFC" : undefined;
      cells.push(
        new TableCell({
          children,
          shading: isHeader
            ? { type: ShadingType.CLEAR, color: "auto", fill: headerFill }
            : stripeFill
              ? { type: ShadingType.CLEAR, color: "auto", fill: stripeFill }
              : undefined,
          margins: { top: 110, bottom: 110, left: 140, right: 140 },
          columnSpan: Math.max(1, Number(cell.getAttribute("colspan")) || 1),
          rowSpan: Math.max(1, Number(cell.getAttribute("rowspan")) || 1),
          borders: {
            top: { style: BorderStyle.SINGLE, size: 4, color: cleanColor(theme.border) },
            bottom: { style: BorderStyle.SINGLE, size: 4, color: cleanColor(theme.border) },
            left: { style: BorderStyle.SINGLE, size: 4, color: cleanColor(theme.border) },
            right: { style: BorderStyle.SINGLE, size: 4, color: cleanColor(theme.border) },
          },
        }),
      );
    }
    if (cells.length) rows.push(new TableRow({ children: cells, cantSplit: true, tableHeader: rowIndex === 0 }));
  }
  const contentWidth = pageLayout(settings).contentWidth;
  return new Table({
    rows,
    width: { size: contentWidth, type: WidthType.DXA },
    columnWidths: Array.from({ length: columnCount }, () => Math.floor(contentWidth / columnCount)),
    alignment: AlignmentType.CENTER,
  });
}

function dividerParagraph(theme: Theme) {
  const style =
    theme.dividerStyle === "dashed" ? BorderStyle.DASHED : theme.dividerStyle === "dotted" ? BorderStyle.DOTTED : BorderStyle.SINGLE;
  return new Paragraph({
    spacing: { before: 180, after: 240 },
    border: { bottom: { style, size: 6, color: cleanColor(theme.border), space: 1 } },
  });
}

async function codeParagraph(node: Element, theme: Theme) {
  const dark = theme.codeStyle === "dark";
  const codeStyle: InlineStyle = {
    font: "Consolas",
    color: dark ? "E5E7EB" : cleanColor(theme.text),
    size: Math.max(18, pxToHalfPoints(theme.bodyFontSize) - 2),
  };
  const children = (
    await Promise.all(
      Array.from(node.querySelector("code")?.childNodes ?? node.childNodes).map((child) => inlineChildren(child, theme, codeStyle)),
    )
  ).flat();
  return new Paragraph({
    children: children.length ? children : [textRun("", theme, { font: "Consolas" })],
    spacing: { before: 100, after: pxToTwips(theme.paragraphSpacing), line: 280 },
    indent: { left: 240, right: 240 },
    shading: { type: ShadingType.CLEAR, color: "auto", fill: dark ? "1F2937" : cleanColor(theme.codeBg) },
    border: {
      top: { style: BorderStyle.SINGLE, size: 3, color: cleanColor(theme.border) },
      bottom: { style: BorderStyle.SINGLE, size: 3, color: cleanColor(theme.border) },
      left: { style: BorderStyle.SINGLE, size: 3, color: cleanColor(theme.border) },
      right: { style: BorderStyle.SINGLE, size: 3, color: cleanColor(theme.border) },
    },
    keepLines: true,
  });
}

async function blockChildren(root: ParentNode, theme: Theme, settings: WordExportSettings): Promise<Array<Paragraph | Table>> {
  const output: Array<Paragraph | Table> = [];
  for (const node of Array.from(root.children)) {
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      output.push(
        await paragraphFromNode(node, theme, settings, {
          headingLevel: Number(tag.slice(1)) - 1,
          bookmarkId: node.getAttribute("data-word-bookmark") ?? undefined,
        }),
      );
    } else if (tag === "P") {
      const onlyImage = node.children.length === 1 && node.firstElementChild?.tagName === "IMG" && !(node.textContent ?? "").trim();
      output.push(await paragraphFromNode(node, theme, settings, { alignment: onlyImage ? AlignmentType.CENTER : undefined }));
    } else if (tag === "BLOCKQUOTE") {
      const children = (
        await Promise.all(
          Array.from(node.childNodes).map((child) =>
            inlineChildren(child, theme, { color: cleanColor(theme.muted), italics: theme.blockquoteStyle === "quote" }, settings),
          ),
        )
      ).flat();
      output.push(
        new Paragraph({
          children: children.length ? children : [textRun(node.textContent ?? "", theme)],
          indent: { left: 360, right: 220 },
          spacing: { before: 100, after: pxToTwips(theme.paragraphSpacing), line: bodyLineSpacing(theme) },
          shading:
            theme.blockquoteStyle === "card" ? { type: ShadingType.CLEAR, color: "auto", fill: cleanColor(theme.accentSoft) } : undefined,
          border: { left: { style: BorderStyle.SINGLE, size: 18, color: cleanColor(theme.accent), space: 10 } },
          keepLines: true,
        }),
      );
    } else if (tag === "PRE") {
      output.push(await codeParagraph(node, theme));
    } else if (tag === "UL" || tag === "OL") {
      output.push(...(await listParagraphs(node as HTMLUListElement | HTMLOListElement, theme, settings)));
    } else if (tag === "TABLE") {
      output.push(await tableFromNode(node as HTMLTableElement, theme, settings));
      output.push(new Paragraph({ spacing: { after: pxToTwips(theme.paragraphSpacing) } }));
    } else if (tag === "HR") {
      output.push(dividerParagraph(theme));
    } else if (tag === "FIGURE") {
      const image = node.querySelector(":scope > img");
      const caption = node.querySelector(":scope > figcaption");
      if (image) {
        output.push(
          new Paragraph({
            children: await inlineChildren(image, theme, {}, settings),
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: caption ? 80 : pxToTwips(theme.imageSpacing) },
            keepLines: true,
          }),
        );
      }
      if (caption) {
        output.push(
          await paragraphFromNode(caption, theme, settings, {
            style: { color: cleanColor(theme.muted), size: pxToHalfPoints(theme.imageCaptionSize) },
            alignment: wordAlignment(theme.imageCaptionAlign),
            compact: true,
          }),
        );
      }
      for (const child of Array.from(node.children)) {
        if (child !== image && child !== caption) output.push(...(await blockChildren(child, theme, settings)));
      }
    } else if (tag === "SECTION") {
      output.push(...(await blockChildren(node, theme, settings)));
    } else {
      output.push(await paragraphFromNode(node, theme, settings));
    }
  }
  return output;
}

function headingDefault(theme: Theme, key: HeadingKey) {
  const config = theme.headings[key];
  return {
    paragraph: {
      alignment: wordAlignment(config.align),
      spacing: { before: 300, after: 160 },
      keepNext: true,
      keepLines: true,
    },
    run: {
      font: getWordFontName(theme),
      color: cleanColor(config.color),
      size: pxToHalfPoints(config.fontSize),
      bold: true,
    },
  };
}

function prepareWordBody(root: DocumentFragment, title: string, settings: WordExportSettings): HeadingEntry[] {
  root.querySelectorAll<HTMLElement>("[data-outline-index]").forEach((element) => element.removeAttribute("data-outline-index"));
  if (settings.showTitle && settings.removeDuplicateTitle) {
    let first = root.firstElementChild;
    while (first && ["SECTION", "ARTICLE", "MAIN", "DIV"].includes(first.tagName) && first.firstElementChild) {
      first = first.firstElementChild;
    }
    if (first?.tagName === "H1" && first.textContent?.trim() === title.trim()) first.remove();
  }
  return Array.from(root.querySelectorAll<HTMLElement>("h1, h2, h3, h4, h5, h6")).map((heading, index) => {
    const entry = {
      id: `word-heading-${index + 1}`,
      level: Number(heading.tagName.slice(1)),
      text: heading.textContent?.trim() || `标题 ${index + 1}`,
    };
    heading.setAttribute("data-word-bookmark", entry.id);
    return entry;
  });
}

function tableOfContents(theme: Theme, settings: WordExportSettings, headings: HeadingEntry[]) {
  const entries = headings.filter((heading) => heading.level <= settings.tocDepth);
  if (!entries.length) return [];
  return [
    new Paragraph({
      children: [textRun("目录", theme, { bold: true, color: cleanColor(theme.heading), size: 30 })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 80, after: 180 },
      keepNext: true,
    }),
    ...entries.map(
      (entry) =>
        new Paragraph({
          children: [
            new InternalHyperlink({
              anchor: entry.id,
              children: [
                textRun(entry.text, theme, {
                  color: entry.level === 1 ? cleanColor(theme.heading) : cleanColor(theme.text),
                  bold: entry.level === 1,
                  size: Math.max(18, pxToHalfPoints(theme.bodyFontSize) - (entry.level - 1)),
                }),
              ],
            }),
          ],
          indent: { left: (entry.level - 1) * 360 },
          spacing: { after: 80, line: 280 },
          keepLines: true,
        }),
    ),
    dividerParagraph(theme),
  ];
}

export async function buildWordDocument(options: ExportWordOptions) {
  const settings = normalizeWordExportSettings(options.settings ?? defaultWordExportSettings);
  const layout = pageLayout(settings);
  const effectiveSettings = {
    ...settings,
    imageMaxWidth: Math.min(settings.imageMaxWidth, Math.max(280, Math.floor(layout.contentWidth / 15))),
  };
  const theme = applyWordSettingsToTheme(options.theme, effectiveSettings);
  const template = document.createElement("template");
  template.innerHTML = options.bodyHtml;
  const headings = prepareWordBody(template.content, options.title, effectiveSettings);
  const font = getWordFontName(theme);
  const accent = cleanColor(theme.accent);
  const title = new Paragraph({
    children: [
      textRun(options.title || "未命名文章", theme, {
        bold: true,
        color: cleanColor(theme.heading),
        size: Math.max(36, pxToHalfPoints(theme.headings.h1.fontSize) + 6),
      }),
    ],
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 360, line: 360 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: accent, space: 12 } },
    keepNext: true,
  });
  const children = [
    ...(effectiveSettings.showTitle ? [title] : []),
    ...(effectiveSettings.includeToc ? tableOfContents(theme, effectiveSettings, headings) : []),
    ...(await blockChildren(template.content, theme, effectiveSettings)),
  ];
  const footerChildren: WordChild[] = [];
  if (effectiveSettings.showFooterTitle) {
    footerChildren.push(textRun(options.title || "未命名文章", theme, { color: cleanColor(theme.muted), size: 18 }));
  }
  if (effectiveSettings.showFooterTitle && effectiveSettings.showPageNumbers) {
    footerChildren.push(textRun("  ·  ", theme, { color: cleanColor(theme.border), size: 18 }));
  }
  if (effectiveSettings.showPageNumbers) {
    footerChildren.push(new TextRun({ children: [PageNumber.CURRENT], font, color: cleanColor(theme.muted), size: 18 }));
  }
  const footer = footerChildren.length
    ? new Footer({
        children: [
          new Paragraph({
            children: footerChildren,
            alignment: AlignmentType.CENTER,
            border: { top: { style: BorderStyle.SINGLE, size: 2, color: cleanColor(theme.border), space: 8 } },
          }),
        ],
      })
    : undefined;
  return new DocxDocument({
    creator: "公众号排版助手",
    title: options.title,
    description: "由公众号排版助手导出的文章定稿",
    styles: {
      default: {
        document: {
          run: { font, color: cleanColor(theme.text), size: pxToHalfPoints(theme.bodyFontSize) },
          paragraph: {
            alignment: wordAlignment(theme.bodyTextAlign),
            spacing: { after: pxToTwips(theme.paragraphSpacing), line: bodyLineSpacing(theme) },
          },
        },
        title: { run: { font, color: cleanColor(theme.heading), bold: true }, paragraph: { alignment: AlignmentType.CENTER } },
        heading1: headingDefault(theme, "h1"),
        heading2: headingDefault(theme, "h2"),
        heading3: headingDefault(theme, "h3"),
        heading4: headingDefault(theme, "h4"),
        heading5: headingDefault(theme, "h5"),
        heading6: headingDefault(theme, "h6"),
        hyperlink: { run: { color: accent, underline: { type: UnderlineType.SINGLE, color: accent } } },
      },
    },
    numbering: {
      config: [
        {
          reference: "word-ordered",
          levels: Array.from({ length: 8 }, (_, level) => ({
            level,
            format: LevelFormat.DECIMAL,
            text: `%${level + 1}.`,
            alignment: AlignmentType.LEFT,
            style: {
              run: { font, color: accent },
              paragraph: { indent: { left: 420 + level * 420, hanging: 240 }, spacing: { after: 80 } },
            },
          })),
        },
      ],
    },
    sections: [
      {
        properties: {
          page: { size: { width: layout.width, height: layout.height }, margin: layout.margins },
        },
        footers: footer ? { default: footer } : undefined,
        children,
      },
    ],
  });
}

export async function exportWordDocument(options: ExportWordOptions) {
  const document = await buildWordDocument(options);
  const blob = await Packer.toBlob(document);
  const anchor = window.document.createElement("a");
  const url = URL.createObjectURL(blob);
  anchor.href = url;
  anchor.download = `${sanitizeFileName(options.title)}.docx`;
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}
