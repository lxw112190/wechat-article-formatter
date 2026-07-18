export type ImageAsset = {
  id: string;
  articleId: string;
  name: string;
  type: string;
  blob: Blob;
  originalSize: number;
  compressedSize: number;
  width: number;
  height: number;
  alt: string;
  createdAt: string;
};

export type CompressOptions = {
  maxWidth?: number;
  quality?: number;
};

const databaseName = "wechat-publisher-assets";
const storeName = "images";
const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
let databasePromise: Promise<IDBDatabase> | null = null;

function openDatabase() {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(databaseName, 1);
    request.onupgradeneeded = () => {
      const database = request.result;
      const store = database.objectStoreNames.contains(storeName)
        ? request.transaction?.objectStore(storeName)
        : database.createObjectStore(storeName, { keyPath: "id" });
      if (store && !store.indexNames.contains("articleId")) store.createIndex("articleId", "articleId", { unique: false });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("无法打开图片数据库"));
  });
  return databasePromise;
}

function waitForRequest<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("图片数据库操作失败"));
  });
}

function waitForTransaction(transaction: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new Error("图片数据库事务已取消"));
    transaction.onerror = () => reject(transaction.error ?? new Error("图片数据库事务失败"));
  });
}

export async function getArticleImageAssets(articleId: string) {
  if (!articleId) return [];
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  const request = transaction.objectStore(storeName).index("articleId").getAll(articleId);
  const assets = await waitForRequest(request) as ImageAsset[];
  return assets.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export async function putImageAsset(asset: ImageAsset) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const request = transaction.objectStore(storeName).put(asset);
  await Promise.all([waitForRequest(request), waitForTransaction(transaction)]);
}

export async function deleteImageAsset(id: string) {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  const request = transaction.objectStore(storeName).delete(id);
  await Promise.all([waitForRequest(request), waitForTransaction(transaction)]);
}

export async function deleteArticleImageAssets(articleId: string) {
  const assets = await getArticleImageAssets(articleId);
  await Promise.all(assets.map((asset) => deleteImageAsset(asset.id)));
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("图片压缩失败")), type, quality);
  });
}

function buildAssetId() {
  const date = new Date();
  const stamp = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}`;
  return `IMG-${stamp}-${crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase()}`;
}

function outputName(name: string, id: string, type: string) {
  const extension = type === "image/png" ? "png" : type === "image/webp" ? "webp" : type === "image/gif" ? "gif" : "jpg";
  const base = name.replace(/\.[^.]+$/, "").replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-").slice(0, 60) || "image";
  return `${id}-${base}.${extension}`;
}

export async function compressImageFile(file: File | Blob, articleId: string, sourceName = "粘贴图片", options: CompressOptions = {}, existingId?: string, alt = "") {
  if (!supportedTypes.has(file.type)) throw new Error("仅支持 JPG、PNG、WebP 和 GIF 图片");
  if (file.size > 25 * 1024 * 1024) throw new Error("单张图片不能超过 25MB");

  const bitmap = await createImageBitmap(file);
  const originalWidth = bitmap.width;
  const originalHeight = bitmap.height;
  const id = existingId ?? buildAssetId();

  if (file.type === "image/gif") {
    bitmap.close();
    const blob = file instanceof File ? file.slice(0, file.size, file.type) : file;
    return {
      id, articleId, name: outputName(sourceName, id, file.type), type: file.type, blob,
      originalSize: file.size, compressedSize: blob.size, width: originalWidth, height: originalHeight,
      alt, createdAt: new Date().toISOString(),
    } satisfies ImageAsset;
  }

  const maxWidth = options.maxWidth ?? 1280;
  const scale = Math.min(1, maxWidth / originalWidth);
  const width = Math.max(1, Math.round(originalWidth * scale));
  const height = Math.max(1, Math.round(originalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { alpha: file.type !== "image/jpeg" });
  if (!context) {
    bitmap.close();
    throw new Error("当前浏览器无法压缩图片");
  }
  context.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const outputType = file.type === "image/png" ? "image/png" : file.type === "image/webp" ? "image/webp" : "image/jpeg";
  let compressed = await canvasToBlob(canvas, outputType, outputType === "image/png" ? undefined : options.quality ?? 0.84);
  if (scale === 1 && compressed.size >= file.size) compressed = file instanceof File ? file.slice(0, file.size, file.type) : file;
  const finalType = compressed.type || outputType;

  return {
    id, articleId, name: outputName(sourceName, id, finalType), type: finalType, blob: compressed,
    originalSize: file.size, compressedSize: compressed.size, width, height,
    alt, createdAt: new Date().toISOString(),
  } satisfies ImageAsset;
}
