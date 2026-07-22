import JSZip from "jszip";
import type { ImageAsset } from "../imageAssets";
import { getLocalAssetReferences } from "../markdown/assets";
import type { Article, ArticleVersion } from "../types";
import { normalizeArticles, normalizeHistory } from "./articleStorage";

export const backupFormat = "wechat-article-backup";
export const backupVersion = 3;

export const backupLimits = {
  maxCompressedBytes: 200 * 1024 * 1024,
  maxUncompressedBytes: 500 * 1024 * 1024,
  maxSingleFileBytes: 50 * 1024 * 1024,
  maxEntries: 2_000,
} as const;

type BackupLimits = typeof backupLimits;

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

type BackupFileEntry = {
  path: string;
  size: number;
  sha256: string;
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
  files: BackupFileEntry[];
};

export type CompleteBackupData = {
  articles: Article[];
  history: ArticleVersion[];
  assets: ImageAsset[];
  settings: BackupSettings;
  manifest: BackupManifest;
};

type SizedZipObject = JSZip.JSZipObject & { _data?: { uncompressedSize?: number } };

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

function sourceSize(source: ArrayBuffer | Uint8Array) {
  return source instanceof ArrayBuffer ? source.byteLength : source.byteLength;
}

function mergeLimits(overrides?: Partial<BackupLimits>): BackupLimits {
  return { ...backupLimits, ...overrides };
}

function assertSafePath(path: string) {
  if (!path || path.startsWith("/") || path.startsWith("\\") || path.includes("\\") || path.includes(":"))
    throw new Error(`备份包含不安全路径：${path || "空路径"}`);
  const segments = path.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) throw new Error(`备份包含不安全路径：${path}`);
}

function requireFile(zip: JSZip, path: string) {
  const file = zip.file(path);
  if (!file) throw new Error(`备份文件不完整：缺少 ${path}`);
  return file;
}

async function sha256(bytes: Uint8Array) {
  const source = bytes.slice().buffer;
  const digest = await crypto.subtle.digest("SHA-256", source);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function encodeJson(value: unknown) {
  return new TextEncoder().encode(JSON.stringify(value, null, 2));
}

async function addVerifiedFile(zip: JSZip, files: BackupFileEntry[], path: string, bytes: Uint8Array) {
  assertSafePath(path);
  if (bytes.byteLength > backupLimits.maxSingleFileBytes) throw new Error(`文件 ${path} 超过单文件容量上限`);
  zip.file(path, bytes);
  files.push({ path, size: bytes.byteLength, sha256: await sha256(bytes) });
}

function validateZipStructure(zip: JSZip, limits: BackupLimits) {
  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > limits.maxEntries) throw new Error(`ZIP 条目数超过上限（${limits.maxEntries}）`);
  let declaredTotal = 0;
  for (const entry of entries) {
    assertSafePath(entry.name);
    const size = (entry as SizedZipObject)._data?.uncompressedSize;
    if (typeof size !== "number" || !Number.isFinite(size) || size < 0) continue;
    if (size > limits.maxSingleFileBytes) throw new Error(`文件 ${entry.name} 超过单文件容量上限`);
    declaredTotal += size;
    if (declaredTotal > limits.maxUncompressedBytes) throw new Error("ZIP 解压后总容量超过安全上限");
  }
  return entries;
}

function parseManifest(value: unknown): BackupManifest {
  if (!isRecord(value) || value.format !== backupFormat || typeof value.version !== "number") throw new Error("无法识别备份格式");
  if (value.version > backupVersion) throw new Error(`备份版本 V${value.version} 高于当前支持的 V${backupVersion}，请升级工具后恢复`);
  if (value.version < 2) throw new Error(`该 ZIP 使用不受支持的旧备份版本 V${value.version}`);
  if (value.version === backupVersion && !Array.isArray(value.files)) throw new Error("备份清单缺少文件哈希信息");
  return { ...(value as unknown as BackupManifest), files: Array.isArray(value.files) ? (value.files as BackupFileEntry[]) : [] };
}

async function verifyManifestFiles(zip: JSZip, manifest: BackupManifest, limits: BackupLimits) {
  const actualPaths = Object.values(zip.files)
    .filter((entry) => !entry.dir && entry.name !== "manifest.json")
    .map((entry) => entry.name)
    .sort();
  const listedPaths = manifest.files.map((entry) => entry.path).sort();
  if (new Set(listedPaths).size !== listedPaths.length) throw new Error("备份清单包含重复文件记录");
  if (actualPaths.length !== listedPaths.length || actualPaths.some((path, index) => path !== listedPaths[index]))
    throw new Error("备份清单与 ZIP 实际文件不一致");

  let total = 0;
  const verified = new Map<string, Uint8Array>();
  for (const entry of manifest.files) {
    if (!entry || typeof entry.path !== "string" || !Number.isInteger(entry.size) || entry.size < 0 || !/^[a-f0-9]{64}$/.test(entry.sha256))
      throw new Error("备份清单包含无效哈希记录");
    assertSafePath(entry.path);
    if (entry.size > limits.maxSingleFileBytes) throw new Error(`文件 ${entry.path} 超过单文件容量上限`);
    total += entry.size;
    if (total > limits.maxUncompressedBytes) throw new Error("ZIP 解压后总容量超过安全上限");
    const bytes = await requireFile(zip, entry.path).async("uint8array");
    if (bytes.byteLength !== entry.size) throw new Error(`文件容量校验失败：${entry.path}`);
    if ((await sha256(bytes)) !== entry.sha256) throw new Error(`文件哈希校验失败：${entry.path}`);
    verified.set(entry.path, bytes);
  }
  return verified;
}

async function readLegacyFiles(zip: JSZip, manifest: BackupManifest, limits: BackupLimits) {
  const paths = ["articles.json", "history.json", "settings.json", ...manifest.images.map((entry) => entry.path)];
  const uniquePaths = [...new Set(paths)];
  if (uniquePaths.length !== paths.length) throw new Error("备份清单包含重复文件记录");
  const payload = new Map<string, Uint8Array>();
  let total = 0;
  for (const path of uniquePaths) {
    assertSafePath(path);
    const bytes = await requireFile(zip, path).async("uint8array");
    if (bytes.byteLength > limits.maxSingleFileBytes) throw new Error(`文件 ${path} 超过单文件容量上限`);
    total += bytes.byteLength;
    if (total > limits.maxUncompressedBytes) throw new Error("ZIP 解压后总容量超过安全上限");
    payload.set(path, bytes);
  }
  return payload;
}

export async function createCompleteBackup(data: Omit<CompleteBackupData, "manifest">, appVersion: string) {
  const zip = new JSZip();
  const imageEntries: BackupImageEntry[] = [];
  const files: BackupFileEntry[] = [];

  for (const asset of data.assets) {
    const path = `images/${asset.id}.${imageExtension(asset.type)}`;
    const bytes = new Uint8Array(await asset.blob.arrayBuffer());
    await addVerifiedFile(zip, files, path, bytes);
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

  for (const [index, article] of data.articles.entries()) {
    const filename = `${String(index + 1).padStart(3, "0")}-${safeFilename(article.title)}.md`;
    await addVerifiedFile(zip, files, `markdown/${filename}`, new TextEncoder().encode(article.markdown));
  }

  await addVerifiedFile(zip, files, "articles.json", encodeJson({ version: backupVersion, articles: data.articles }));
  await addVerifiedFile(zip, files, "history.json", encodeJson({ version: backupVersion, history: data.history }));
  await addVerifiedFile(zip, files, "settings.json", encodeJson({ version: backupVersion, settings: data.settings }));

  const totalSize = files.reduce((total, entry) => total + entry.size, 0);
  if (files.length > backupLimits.maxEntries) throw new Error(`备份文件数量超过上限（${backupLimits.maxEntries}）`);
  if (totalSize > backupLimits.maxUncompressedBytes) throw new Error("备份内容总容量超过安全上限");

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
    files,
  };
  zip.file("manifest.json", encodeJson(manifest));
  const output = await zip.generateAsync({ type: "uint8array", compression: "DEFLATE", compressionOptions: { level: 6 } });
  if (output.byteLength > backupLimits.maxCompressedBytes) throw new Error("ZIP 压缩包超过容量上限");
  return output;
}

export async function readCompleteBackup(
  input: Blob | ArrayBuffer | Uint8Array,
  limitOverrides?: Partial<BackupLimits>,
): Promise<CompleteBackupData> {
  const limits = mergeLimits(limitOverrides);
  const source = input instanceof Blob ? await input.arrayBuffer() : input;
  if (sourceSize(source) > limits.maxCompressedBytes) throw new Error("ZIP 压缩包超过容量上限");
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(source);
  } catch {
    throw new Error("无法读取 ZIP：文件可能已损坏或不是完整备份");
  }
  validateZipStructure(zip, limits);

  let manifestValue: unknown;
  const manifestText = await requireFile(zip, "manifest.json").async("string");
  try {
    manifestValue = JSON.parse(manifestText);
  } catch {
    throw new Error("备份清单不是有效 JSON");
  }
  const manifest = parseManifest(manifestValue);
  if (!Array.isArray(manifest.images)) throw new Error("备份清单中的图片信息无效");
  const verified =
    manifest.version === backupVersion ? await verifyManifestFiles(zip, manifest, limits) : await readLegacyFiles(zip, manifest, limits);
  const decodeJson = <T>(path: string) => JSON.parse(new TextDecoder().decode(verified.get(path))) as T;

  const articleValue = decodeJson<{ articles?: unknown }>("articles.json");
  const articles = normalizeArticles(articleValue.articles);
  if (!articles.length) throw new Error("备份中没有有效文章");
  const articleIds = new Set(articles.map((article) => article.id));

  const historyValue = decodeJson<{ history?: unknown }>("history.json");
  const history = normalizeHistory(historyValue.history).filter((version) => articleIds.has(version.articleId));
  const settingsValue = decodeJson<{ settings?: unknown }>("settings.json");
  const rawSettings = isRecord(settingsValue.settings) ? settingsValue.settings : {};
  const settings: BackupSettings = {
    themeId: typeof rawSettings.themeId === "string" ? rawSettings.themeId : "wechat",
    syncScroll: typeof rawSettings.syncScroll === "boolean" ? rawSettings.syncScroll : true,
    outlineOpen: typeof rawSettings.outlineOpen === "boolean" ? rawSettings.outlineOpen : true,
  };

  const assets: ImageAsset[] = [];
  for (const entry of manifest.images) {
    if (!entry || typeof entry.id !== "string" || typeof entry.path !== "string" || typeof entry.mimeType !== "string")
      throw new Error("备份清单包含无效图片记录");
    const bytes = verified.get(entry.path);
    if (!bytes) throw new Error(`备份文件不完整：缺少 ${entry.path}`);
    assets.push({
      id: entry.id,
      articleId: articleIds.has(entry.articleId) ? entry.articleId : articles[0].id,
      name: entry.name || `${entry.id}.${imageExtension(entry.mimeType)}`,
      type: entry.mimeType,
      blob: new Blob([bytes.slice().buffer], { type: entry.mimeType }),
      originalSize: Number.isFinite(entry.originalSize) ? entry.originalSize : bytes.byteLength,
      compressedSize: bytes.byteLength,
      width: Number.isFinite(entry.width) ? entry.width : 0,
      height: Number.isFinite(entry.height) ? entry.height : 0,
      alt: entry.alt || "",
      createdAt: entry.createdAt || new Date().toISOString(),
    });
  }

  if (manifest.articleCount !== articles.length || manifest.historyCount !== history.length || manifest.imageCount !== assets.length)
    throw new Error("备份清单与实际内容数量不一致，文件可能不完整");
  return { articles, history, assets, settings, manifest };
}

export function getBackupFilename(date = new Date()) {
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `wechat-backup-${stamp}.zip`;
}
