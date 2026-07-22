import JSZip from "jszip";
import type { ImageAsset } from "../imageAssets";
import { getLocalAssetReferences } from "../markdown/assets";
import type { Article, ArticleVersion } from "../types";
import { normalizeArticles, normalizeHistory } from "./articleStorage";

export const backupFormat = "wechat-article-backup";
export const backupVersion = 2;

export type BackupSettings = {
  themeId: string;
  syncScroll: boolean;
  outlineOpen: boolean;
};

type BackupImageEntry = {
  id: string;
  articleId: string;
  name: string;
  path: string;
  mimeType: string;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  alt: string;
  createdAt: string;
};

export type BackupManifest = {
  format: typeof backupFormat;
  version: number;
  appVersion: string;
  exportedAt: string;
  articleCount: number;
  historyCount: number;
  imageCount: number;
  articles: Array<{ articleId: string; imageIds: string[] }>;
  images: BackupImageEntry[];
};

export type CompleteBackupData = {
  articles: Article[];
  history: ArticleVersion[];
  assets: ImageAsset[];
  settings: BackupSettings;
  manifest: BackupManifest;
};

function imageExtension(type: string) {
  if (type === "image/png") return "png";
  if (type === "image/webp") return "webp";
  if (type === "image/gif") return "gif";
  return "jpg";
}

function safeFilename(value: string) {
  return (
    value
      .replace(/[<>:"/\\|?*]/g, "-")
      .split("")
      .map((character) => (character.charCodeAt(0) < 32 ? "-" : character))
      .join("")
      .replace(/[. ]+$/g, "")
      .slice(0, 80) || "未命名文章"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function requireFile(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) throw new Error(`备份文件不完整：缺少 ${path}`);
  return file;
}

export async function createCompleteBackup(data: Omit<CompleteBackupData, "manifest">, appVersion: string) {
  const zip = new JSZip();
  const imageEntries: BackupImageEntry[] = [];

  for (const asset of data.assets) {
    const path = `images/${asset.id}.${imageExtension(asset.type)}`;
    zip.file(path, new Uint8Array(await asset.blob.arrayBuffer()));
    imageEntries.push({
      id: asset.id,
      articleId: asset.articleId,
      name: asset.name,
      path,
      mimeType: asset.type,
      originalSize: asset.originalSize,
      compressedSize: asset.compressedSize,
      width: asset.width,
      height: asset.height,
      alt: asset.alt,
      createdAt: asset.createdAt,
    });
  }

  data.articles.forEach((article, index) => {
    const filename = `${String(index + 1).padStart(3, "0")}-${safeFilename(article.title)}.md`;
    zip.file(`markdown/${filename}`, article.markdown);
  });

  const manifest: BackupManifest = {
    format: backupFormat,
    version: backupVersion,
    appVersion,
    exportedAt: new Date().toISOString(),
    articleCount: data.articles.length,
    historyCount: data.history.length,
    imageCount: data.assets.length,
    articles: data.articles.map((article) => ({
      articleId: article.id,
      imageIds: getLocalAssetReferences(article.markdown).map((item) => item.id),
    })),
    images: imageEntries,
  };

  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("articles.json", JSON.stringify({ version: backupVersion, articles: data.articles }, null, 2));
  zip.file("history.json", JSON.stringify({ version: backupVersion, history: data.history }, null, 2));
  zip.file("settings.json", JSON.stringify({ version: backupVersion, settings: data.settings }, null, 2));
  return zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
}

export async function readCompleteBackup(input: Blob | ArrayBuffer | Uint8Array): Promise<CompleteBackupData> {
  const source = input instanceof Blob ? await input.arrayBuffer() : input;
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(source);
  } catch {
    throw new Error("无法读取 ZIP：文件可能已损坏或不是完整备份");
  }

  const manifestValue = JSON.parse(await requireFile(zip, "manifest.json").async("string")) as unknown;
  if (!isRecord(manifestValue) || manifestValue.format !== backupFormat || typeof manifestValue.version !== "number")
    throw new Error("无法识别备份格式");
  if (manifestValue.version > backupVersion)
    throw new Error(`备份版本 V${manifestValue.version} 高于当前支持的 V${backupVersion}，请升级工具后恢复`);
  if (manifestValue.version < backupVersion)
    throw new Error(`该 ZIP 使用旧备份版本 V${manifestValue.version}，当前仅支持完整备份 V${backupVersion}`);
  const manifest = manifestValue as unknown as BackupManifest;

  const articleValue = JSON.parse(await requireFile(zip, "articles.json").async("string")) as { articles?: unknown };
  const articles = normalizeArticles(articleValue.articles);
  if (!articles.length) throw new Error("备份中没有有效文章");
  const articleIds = new Set(articles.map((article) => article.id));

  const historyValue = JSON.parse(await requireFile(zip, "history.json").async("string")) as { history?: unknown };
  const history = normalizeHistory(historyValue.history).filter((version) => articleIds.has(version.articleId));

  const settingsValue = JSON.parse(await requireFile(zip, "settings.json").async("string")) as { settings?: unknown };
  const rawSettings = isRecord(settingsValue.settings) ? settingsValue.settings : {};
  const settings: BackupSettings = {
    themeId: typeof rawSettings.themeId === "string" ? rawSettings.themeId : "wechat",
    syncScroll: typeof rawSettings.syncScroll === "boolean" ? rawSettings.syncScroll : true,
    outlineOpen: typeof rawSettings.outlineOpen === "boolean" ? rawSettings.outlineOpen : true,
  };

  if (!Array.isArray(manifest.images)) throw new Error("备份清单中的图片信息无效");
  const assets: ImageAsset[] = [];
  for (const entry of manifest.images) {
    if (!entry || typeof entry.id !== "string" || typeof entry.path !== "string" || typeof entry.mimeType !== "string")
      throw new Error("备份清单包含无效图片记录");
    const bytes = await requireFile(zip, entry.path).async("uint8array");
    assets.push({
      id: entry.id,
      articleId: articleIds.has(entry.articleId) ? entry.articleId : articles[0].id,
      name: entry.name || `${entry.id}.${imageExtension(entry.mimeType)}`,
      type: entry.mimeType,
      blob: new Blob([bytes.slice().buffer as ArrayBuffer], { type: entry.mimeType }),
      originalSize: Number.isFinite(entry.originalSize) ? entry.originalSize : bytes.byteLength,
      compressedSize: bytes.byteLength,
      width: Number.isFinite(entry.width) ? entry.width : 0,
      height: Number.isFinite(entry.height) ? entry.height : 0,
      alt: entry.alt || "",
      createdAt: entry.createdAt || new Date().toISOString(),
    });
  }

  if (manifest.articleCount !== articles.length || manifest.imageCount !== assets.length)
    throw new Error("备份清单与实际内容数量不一致，文件可能不完整");
  return { articles, history, assets, settings, manifest };
}

export function getBackupFilename(date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `wechat-backup-${stamp}.zip`;
}
