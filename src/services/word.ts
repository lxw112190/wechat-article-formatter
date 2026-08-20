import {
  AlignmentType,
  BorderStyle,
  Document as DocxDocument,
  ExternalHyperlink,
  Footer,
  HeadingLevel,
  ImageRun,
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
};

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

type WordChild = TextRun | ImageRun | ExternalHyperlink;
type HeadingKey = keyof Theme["headings"];

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
const bodyLineSpacing = (theme: Theme) => Math.round(theme.bodyLineHeight * 240);

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

async function loadImageRun(image: HTMLImageElement) {
  const src = image.currentSrc || image.src;
  if (!src) return null;
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    const type = toImageType(blob, src);
    if (!type) return null;
    const width = Number(image.getAttribute("width")) || image.naturalWidth || 560;
    const height = Number(image.getAttribute("height")) || image.naturalHeight || Math.round(width * 0.56);
    const alt = image.alt || "文章图片";
    return new ImageRun({
      type,
      data: new Uint8Array(await blob.arrayBuffer()),
      transformation: fitImageSize(width, height),
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

async function inlineChildren(node: Node, theme: Theme, style: InlineStyle = {}): Promise<WordChild[]> {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ? [textRun(node.textContent, theme, style)] : [];
  if (!(node instanceof HTMLElement)) return [];
  if (node.tagName === "BR") return [new TextRun({ break: 1 })];
  if (node.tagName === "IMG") {
    const run = await loadImageRun(node as HTMLImageElement);
    if (run) return [run];
    const image = node as HTMLImageElement;
    return [textRun(`【图片：${image.alt || "未加载"}】${image.src ? ` 原图：${image.src}` : ""}`, theme, style)];
  }
  if (node.tagName === "A") {
    const linkStyle = { ...style, color: cleanColor(theme.accent), underline: true };
    const children = (await Promise.all(Array.from(node.childNodes).map((child) => inlineChildren(child, theme, linkStyle)))).flat();
    const href = node.getAttribute("href")?.trim();
    return href ? [new ExternalHyperlink({ link: href, children })] : children;
  }
  const isInlineCode = node.tagName === "CODE";
  const nextStyle: InlineStyle = {
    ...style,
    bold: style.bold || node.tagName === "STRONG" || node.tagName === "B",
    italics: style.italics || node.tagName === "EM" || node.tagName === "I",
    strike: style.strike || node.tagName === "DEL" || node.tagName === "S",
    font: isInlineCode || node.tagName === "PRE" ? "Consolas" : style.font,
    color: isInlineCode ? cleanColor(theme.heading) : style.color,
    shading: isInlineCode ? cleanColor(theme.codeBg) : style.shading,
  };
  return (await Promise.all(Array.from(node.childNodes).map((child) => inlineChildren(child, theme, nextStyle)))).flat();
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
  options: {
    headingLevel?: number;
    level?: number;
    bullet?: boolean;
    numbering?: boolean;
    style?: InlineStyle;
    compact?: boolean;
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
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
    children.push(...(await inlineChildren(child, theme, baseStyle)));
  }
  return new Paragraph({
    children: children.length ? children : [textRun("", theme, baseStyle)],
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
  });
}

async function listParagraphs(list: HTMLUListElement | HTMLOListElement, theme: Theme, level = 0): Promise<Paragraph[]> {
  const ordered = list.tagName === "OL";
  const paragraphs: Paragraph[] = [];
  for (const child of Array.from(list.children)) {
    if (!(child instanceof HTMLLIElement)) continue;
    paragraphs.push(await paragraphFromNode(child, theme, { level, bullet: !ordered, numbering: ordered, compact: true }));
    for (const nested of Array.from(child.children)) {
      if (nested.tagName === "UL" || nested.tagName === "OL")
        paragraphs.push(...(await listParagraphs(nested as HTMLUListElement | HTMLOListElement, theme, level + 1)));
    }
  }
  if (paragraphs.length) paragraphs.push(new Paragraph({ spacing: { after: Math.max(60, pxToTwips(theme.listSpacing)) } }));
  return paragraphs;
}

async function tableFromNode(table: HTMLTableElement, theme: Theme) {
  const rows: TableRow[] = [];
  const sourceRows = Array.from(table.querySelectorAll(":scope > thead > tr, :scope > tbody > tr, :scope > tr"));
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
              paragraphFromNode(paragraph, theme, { style: cellStyle, compact: true }),
            ),
          )
        : [await paragraphFromNode(cell, theme, { style: cellStyle, compact: true })];
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
  return new Table({
    rows,
    width: { size: 100, type: WidthType.PERCENTAGE },
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
  const lines = (node.textContent ?? "").replace(/\r\n?/g, "\n").split("\n");
  const children: WordChild[] = [];
  lines.forEach((line, index) => {
    if (index > 0) children.push(new TextRun({ break: 1 }));
    if (line) children.push(textRun(line, theme, codeStyle));
  });
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

async function blockChildren(root: ParentNode, theme: Theme): Promise<Array<Paragraph | Table>> {
  const output: Array<Paragraph | Table> = [];
  for (const node of Array.from(root.children)) {
    const tag = node.tagName;
    if (/^H[1-6]$/.test(tag)) {
      output.push(await paragraphFromNode(node, theme, { headingLevel: Number(tag.slice(1)) - 1 }));
    } else if (tag === "P") {
      const onlyImage = node.children.length === 1 && node.firstElementChild?.tagName === "IMG" && !(node.textContent ?? "").trim();
      output.push(await paragraphFromNode(node, theme, { alignment: onlyImage ? AlignmentType.CENTER : undefined }));
    } else if (tag === "BLOCKQUOTE") {
      const children = (
        await Promise.all(
          Array.from(node.childNodes).map((child) =>
            inlineChildren(child, theme, { color: cleanColor(theme.muted), italics: theme.blockquoteStyle === "quote" }),
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
      output.push(...(await listParagraphs(node as HTMLUListElement | HTMLOListElement, theme)));
    } else if (tag === "TABLE") {
      output.push(await tableFromNode(node as HTMLTableElement, theme));
      output.push(new Paragraph({ spacing: { after: pxToTwips(theme.paragraphSpacing) } }));
    } else if (tag === "HR") {
      output.push(dividerParagraph(theme));
    } else if (tag === "FIGURE") {
      const image = node.querySelector(":scope > img");
      const caption = node.querySelector(":scope > figcaption");
      if (image) {
        output.push(
          new Paragraph({
            children: await inlineChildren(image, theme),
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: caption ? 80 : pxToTwips(theme.imageSpacing) },
            keepLines: true,
          }),
        );
      }
      if (caption) {
        output.push(
          await paragraphFromNode(caption, theme, {
            style: { color: cleanColor(theme.muted), size: pxToHalfPoints(theme.imageCaptionSize) },
            alignment: wordAlignment(theme.imageCaptionAlign),
            compact: true,
          }),
        );
      }
      for (const child of Array.from(node.children)) {
        if (child !== image && child !== caption) output.push(...(await blockChildren(child, theme)));
      }
    } else if (tag === "SECTION") {
      output.push(...(await blockChildren(node, theme)));
    } else {
      output.push(await paragraphFromNode(node, theme));
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

export async function buildWordDocument(options: ExportWordOptions) {
  const template = document.createElement("template");
  template.innerHTML = options.bodyHtml;
  const font = getWordFontName(options.theme);
  const accent = cleanColor(options.theme.accent);
  const title = new Paragraph({
    children: [
      textRun(options.title || "未命名文章", options.theme, {
        bold: true,
        color: cleanColor(options.theme.heading),
        size: Math.max(36, pxToHalfPoints(options.theme.headings.h1.fontSize) + 6),
      }),
    ],
    heading: HeadingLevel.TITLE,
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 360, line: 360 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 10, color: accent, space: 12 } },
    keepNext: true,
  });
  const children = [title, ...(await blockChildren(template.content, options.theme))];
  return new DocxDocument({
    creator: "公众号排版助手",
    title: options.title,
    description: "由公众号排版助手导出的文章定稿",
    styles: {
      default: {
        document: {
          run: { font, color: cleanColor(options.theme.text), size: pxToHalfPoints(options.theme.bodyFontSize) },
          paragraph: {
            alignment: wordAlignment(options.theme.bodyTextAlign),
            spacing: { after: pxToTwips(options.theme.paragraphSpacing), line: bodyLineSpacing(options.theme) },
          },
        },
        title: { run: { font, color: cleanColor(options.theme.heading), bold: true }, paragraph: { alignment: AlignmentType.CENTER } },
        heading1: headingDefault(options.theme, "h1"),
        heading2: headingDefault(options.theme, "h2"),
        heading3: headingDefault(options.theme, "h3"),
        heading4: headingDefault(options.theme, "h4"),
        heading5: headingDefault(options.theme, "h5"),
        heading6: headingDefault(options.theme, "h6"),
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
          page: { margin: { top: 1080, right: 1260, bottom: 1080, left: 1260, header: 500, footer: 500, gutter: 0 } },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                children: [
                  textRun(options.title || "未命名文章", options.theme, { color: cleanColor(options.theme.muted), size: 18 }),
                  textRun("  ·  ", options.theme, { color: cleanColor(options.theme.border), size: 18 }),
                  new TextRun({ children: [PageNumber.CURRENT], font, color: cleanColor(options.theme.muted), size: 18 }),
                ],
                alignment: AlignmentType.CENTER,
                border: { top: { style: BorderStyle.SINGLE, size: 2, color: cleanColor(options.theme.border), space: 8 } },
              }),
            ],
          }),
        },
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
