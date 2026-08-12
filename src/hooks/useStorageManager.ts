import { useState } from "react";
import { getAllImageAssets, deleteUnusedImageAssets, describeStorageError } from "../imageAssets";
import { getReferencedAssetIds } from "../markdown/assets";
import type { Article, ArticleVersion, DeletedArticle } from "../types";

export type StorageSnapshot = {
  usage: number | null;
  quota: number | null;
  persistent: boolean | null;
  localStorageBytes: number;
  imageBytes: number;
  imageCount: number;
  unusedImageCount: number;
};

type UseStorageManagerOptions = {
  articles: Article[];
  trash: DeletedArticle[];
  history: ArticleVersion[];
  refreshAssets: () => void;
  onError: (message: string) => void;
};

function getLocalStorageBytes(storage: Storage) {
  let total = 0;
  for (let index = 0; index < storage.length; index += 1) {
    const key = storage.key(index) ?? "";
    const value = storage.getItem(key) ?? "";
    total += new Blob([key, value]).size;
  }
  return total;
}

export function useStorageManager({ articles, trash, history, refreshAssets, onError }: UseStorageManagerOptions) {
  const [storageOpen, setStorageOpen] = useState(false);
  const [storageBusy, setStorageBusy] = useState(false);
  const [storageMessage, setStorageMessage] = useState("");
  const [storageSnapshot, setStorageSnapshot] = useState<StorageSnapshot | null>(null);

  function getReferencedIds() {
    return getReferencedAssetIds([
      ...articles.map((article) => article.markdown),
      ...trash.map((article) => article.markdown),
      ...history.map((version) => version.markdown),
    ]);
  }

  async function refreshStorageSnapshot() {
    setStorageBusy(true);
    onError("");
    try {
      const [assets, estimate, persistent] = await Promise.all([
        getAllImageAssets(),
        navigator.storage?.estimate?.() ?? Promise.resolve({}),
        navigator.storage?.persisted?.() ?? Promise.resolve(null),
      ]);
      const referencedIds = getReferencedIds();
      setStorageSnapshot({
        usage: typeof estimate.usage === "number" ? estimate.usage : null,
        quota: typeof estimate.quota === "number" ? estimate.quota : null,
        persistent,
        localStorageBytes: getLocalStorageBytes(window.localStorage),
        imageBytes: assets.reduce((total, asset) => total + asset.compressedSize, 0),
        imageCount: assets.length,
        unusedImageCount: assets.filter((asset) => !referencedIds.has(asset.id)).length,
      });
    } catch (error) {
      onError(describeStorageError(error, "读取存储空间"));
    } finally {
      setStorageBusy(false);
    }
  }

  function openStorageManager() {
    setStorageOpen(true);
    void refreshStorageSnapshot();
  }

  async function requestPersistentStorage() {
    if (!navigator.storage?.persist) {
      setStorageMessage("当前浏览器不支持申请持久化存储");
      return;
    }
    setStorageBusy(true);
    try {
      const granted = await navigator.storage.persist();
      setStorageMessage(granted ? "浏览器已允许持久化存储" : "浏览器未授予持久化存储；请继续定期导出完整备份");
      await refreshStorageSnapshot();
    } catch {
      setStorageMessage("持久化存储申请失败；请继续定期导出完整备份");
      setStorageBusy(false);
    }
  }

  async function cleanupUnusedImages() {
    if (!storageSnapshot?.unusedImageCount) return;
    if (!window.confirm(`确定清理 ${storageSnapshot.unusedImageCount} 张未被文章、历史或回收站引用的图片吗？`)) return;
    setStorageBusy(true);
    try {
      const deleted = await deleteUnusedImageAssets(getReferencedIds());
      refreshAssets();
      setStorageMessage(`已清理 ${deleted} 张未使用图片`);
      await refreshStorageSnapshot();
    } catch (error) {
      onError(describeStorageError(error, "清理未使用图片"));
      setStorageBusy(false);
    }
  }

  return {
    storageOpen,
    setStorageOpen,
    storageBusy,
    storageMessage,
    storageSnapshot,
    openStorageManager,
    refreshStorageSnapshot,
    requestPersistentStorage,
    cleanupUnusedImages,
  };
}
