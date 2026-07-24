import type { Theme, ThemeHeadingLevel } from "../types";
import { defaultTheme } from "../themes/themes";

export const customThemeStorageKey = "wechat-publisher-custom-themes";
export const themeFileFormat = "wechat-article-theme";
export const themeFileVersion = 2;

type ThemeFile = {
  format: typeof themeFileFormat;
  version: number;
  exportedAt: string;
  theme: Theme;
};

const enumValues = {
  fontFamily: ["system", "microsoft-yahei", "pingfang", "noto-sans", "serif", "songti", "kaiti", "fangsong", "rounded", "arial"],
  headingAlign: ["left", "center", "right"],
  headingDecoration: ["left-bar", "underline", "filled", "pill", "plain"],
  bodyTextAlign: ["left", "justify"],
  unorderedListStyle: ["disc", "circle", "square"],
  orderedListStyle: ["decimal", "cjk-ideographic", "decimal-leading-zero"],
  strongStyle: ["color", "highlight", "underline"],
  linkStyle: ["underline", "bottom-border", "plain"],
  blockquoteStyle: ["left-bar", "card", "quote"],
  codeStyle: ["soft", "dark", "bordered"],
  tableStyle: ["soft-header", "accent-header", "minimal"],
  imageStyle: ["rounded", "square", "shadow"],
  dividerStyle: ["solid", "dashed", "dotted"],
  imageCaptionAlign: ["left", "center", "right"],
} as const;

const headingLevels: ThemeHeadingLevel[] = ["h1", "h2", "h3", "h4", "h5", "h6"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function text(value: unknown, fallback: string, maxLength: number) {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, maxLength) : fallback;
}

function color(value: unknown, fallback: string) {
  return typeof value === "string" && /^#[\da-f]{6}$/i.test(value) ? value.toLowerCase() : fallback;
}

function numberInRange(value: unknown, fallback: number, minimum: number, maximum: number, step = 1) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  const rounded = Math.round(Math.min(maximum, Math.max(minimum, value)) / step) * step;
  const precision = step.toString().split(".")[1]?.length ?? 0;
  return Number(rounded.toFixed(precision));
}

function enumValue<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return typeof value === "string" && values.includes(value) ? (value as T[number]) : fallback;
}

function normalizeHeadings(source: Record<string, unknown>, fallback: Theme) {
  const rawHeadings = isRecord(source.headings) ? source.headings : {};
  return Object.fromEntries(
    headingLevels.map((level, index) => {
      const raw = isRecord(rawHeadings[level]) ? rawHeadings[level] : {};
      const legacySize = source[`${level}Size`];
      const legacyAlign = level === "h1" ? source.h1Align : undefined;
      const legacyDecoration = level === "h2" ? source.h2Style : undefined;
      const legacyColor = level === "h6" ? source.muted : source.heading;
      const minimum = index === 0 ? 20 : index === 1 ? 17 : 12;
      const maximum = index === 0 ? 40 : index === 1 ? 34 : 28;
      return [
        level,
        {
          fontSize: numberInRange(raw.fontSize ?? legacySize, fallback.headings[level].fontSize, minimum, maximum),
          color: color(raw.color, color(legacyColor, fallback.headings[level].color)),
          align: enumValue(raw.align ?? legacyAlign, enumValues.headingAlign, fallback.headings[level].align),
          decoration: enumValue(raw.decoration ?? legacyDecoration, enumValues.headingDecoration, fallback.headings[level].decoration),
        },
      ];
    }),
  ) as Theme["headings"];
}

export function normalizeTheme(value: unknown, fallback: Theme = defaultTheme): Theme {
  const source = isRecord(value) ? value : {};
  return {
    id: text(source.id, fallback.id, 80),
    name: text(source.name, fallback.name, 30),
    accent: color(source.accent, fallback.accent),
    accentSoft: color(source.accentSoft, fallback.accentSoft),
    heading: color(source.heading, fallback.heading),
    text: color(source.text, fallback.text),
    muted: color(source.muted, fallback.muted),
    border: color(source.border, fallback.border),
    codeBg: color(source.codeBg, fallback.codeBg),
    fontFamily: enumValue(source.fontFamily, enumValues.fontFamily, fallback.fontFamily),
    bodyFontSize: numberInRange(source.bodyFontSize, fallback.bodyFontSize, 13, 20),
    bodyLineHeight: numberInRange(source.bodyLineHeight, fallback.bodyLineHeight, 1.4, 2.2, 0.05),
    paragraphSpacing: numberInRange(source.paragraphSpacing, fallback.paragraphSpacing, 8, 32),
    bodyTextAlign: enumValue(source.bodyTextAlign, enumValues.bodyTextAlign, fallback.bodyTextAlign),
    letterSpacing: numberInRange(source.letterSpacing, fallback.letterSpacing, 0, 2, 0.1),
    firstLineIndent: numberInRange(source.firstLineIndent, fallback.firstLineIndent, 0, 2, 0.5),
    headings: normalizeHeadings(source, fallback),
    unorderedListStyle: enumValue(source.unorderedListStyle, enumValues.unorderedListStyle, fallback.unorderedListStyle),
    orderedListStyle: enumValue(source.orderedListStyle, enumValues.orderedListStyle, fallback.orderedListStyle),
    listSpacing: numberInRange(source.listSpacing, fallback.listSpacing, 0, 16),
    strongStyle: enumValue(source.strongStyle, enumValues.strongStyle, fallback.strongStyle),
    linkStyle: enumValue(source.linkStyle, enumValues.linkStyle, fallback.linkStyle),
    blockquoteStyle: enumValue(source.blockquoteStyle, enumValues.blockquoteStyle, fallback.blockquoteStyle),
    codeStyle: enumValue(source.codeStyle, enumValues.codeStyle, fallback.codeStyle),
    tableStyle: enumValue(source.tableStyle, enumValues.tableStyle, fallback.tableStyle),
    imageStyle: enumValue(source.imageStyle, enumValues.imageStyle, fallback.imageStyle),
    dividerStyle: enumValue(source.dividerStyle, enumValues.dividerStyle, fallback.dividerStyle),
    imageSpacing: numberInRange(source.imageSpacing, fallback.imageSpacing, 8, 48),
    imageCaptionAlign: enumValue(source.imageCaptionAlign, enumValues.imageCaptionAlign, fallback.imageCaptionAlign),
    imageCaptionSize: numberInRange(source.imageCaptionSize, fallback.imageCaptionSize, 10, 18),
    radius: numberInRange(source.radius, fallback.radius, 0, 20),
  };
}

export function createCustomTheme(base: Theme, id = `custom-${crypto.randomUUID()}`): Theme {
  return normalizeTheme({ ...base, id, name: `${base.name} 自定义` }, base);
}

export function normalizeCustomThemes(value: unknown) {
  if (!Array.isArray(value)) return [];
  const ids = new Set<string>();
  const result: Theme[] = [];
  for (const item of value) {
    const theme = normalizeTheme(item);
    if (!theme.id.startsWith("custom-") || ids.has(theme.id)) continue;
    ids.add(theme.id);
    result.push(theme);
  }
  return result.slice(0, 50);
}

export function loadCustomThemes(storage: Storage) {
  try {
    return normalizeCustomThemes(JSON.parse(storage.getItem(customThemeStorageKey) ?? "[]"));
  } catch {
    return [];
  }
}

export function saveCustomThemes(storage: Storage, themes: Theme[]) {
  storage.setItem(customThemeStorageKey, JSON.stringify(normalizeCustomThemes(themes)));
}

export function serializeTheme(theme: Theme, exportedAt = new Date()) {
  const payload: ThemeFile = {
    format: themeFileFormat,
    version: themeFileVersion,
    exportedAt: exportedAt.toISOString(),
    theme: normalizeTheme(theme),
  };
  return JSON.stringify(payload, null, 2);
}

export function parseThemeFile(content: string, id = `custom-${crypto.randomUUID()}`) {
  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    throw new Error("主题文件不是有效 JSON");
  }
  if (!isRecord(value) || value.format !== themeFileFormat || typeof value.version !== "number") throw new Error("无法识别主题文件格式");
  if (value.version > themeFileVersion) throw new Error(`主题文件版本 V${value.version} 高于当前支持的 V${themeFileVersion}`);
  if (value.version < 1) throw new Error("不支持该主题文件版本");
  if (!isRecord(value.theme)) throw new Error("主题文件缺少主题数据");
  const theme = normalizeTheme(value.theme);
  return { ...theme, id, name: `${theme.name}（导入）` };
}

export function getThemeFilename(theme: Theme) {
  const safeName =
    theme.name
      .replace(/[<>:"/\\|?*]/g, "-")
      .split("")
      .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
      .join("")
      .replace(/[. ]+$/g, "")
      .slice(0, 60) || "自定义主题";
  return `${safeName}.wechat-theme.json`;
}
