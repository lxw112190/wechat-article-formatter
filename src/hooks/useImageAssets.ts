import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, Dispatch, DragEvent as ReactDragEvent, RefObject, SetStateAction } from "react";
import { escapeRegExp, formatBytes } from "../app/formatters";
import { compressImageFile, deleteImageAsset, describeStorageError, getArticleImageAssets, putImageAsset } from "../imageAssets";
import type { ImageAsset } from "../imageAssets";

type UseImageAssetsOptions = {
  activeId: string;
  setMarkdown: Dispatch<SetStateAction<string>>;
  insertBlock: (content: string) => void;
  replaceImageInputRef: RefObject<HTMLInputElement | null>;
  setDragActive: Dispatch<SetStateAction<boolean>>;
  onError: (message: string) => void;
};

export function useImageAssets({
  activeId,
  setMarkdown,
  insertBlock,
  replaceImageInputRef,
  setDragActive,
  onError,
}: UseImageAssetsOptions) {
  const messageTimerRef = useRef<number | null>(null);
  const assetUrlsRef = useRef<Record<string, string>>({});
  const [imageMessage, setImageMessage] = useState("");
  const [imageAssets, setImageAssets] = useState<ImageAsset[]>([]);
  const [assetUrls, setAssetUrls] = useState<Record<string, string>>({});
  const [assetLibraryReady, setAssetLibraryReady] = useState(false);
  const [assetRefreshKey, setAssetRefreshKey] = useState(0);
  const [imageProcessing, setImageProcessing] = useState(false);
  const [replaceAssetId, setReplaceAssetId] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    },
    [],
  );

  useEffect(() => {
    let cancelled = false;
    Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
    assetUrlsRef.current = {};
    setAssetUrls({});
    setImageAssets([]);
    setAssetLibraryReady(false);
    if (!activeId) {
      setAssetLibraryReady(true);
      return () => {
        cancelled = true;
      };
    }

    getArticleImageAssets(activeId)
      .then((assets) => {
        if (cancelled) return;
        const urls = Object.fromEntries(assets.map((asset) => [asset.id, URL.createObjectURL(asset.blob)]));
        assetUrlsRef.current = urls;
        setImageAssets(assets);
        setAssetUrls(urls);
        setAssetLibraryReady(true);
      })
      .catch((error) => {
        if (cancelled) return;
        setAssetLibraryReady(true);
        const message = describeStorageError(error, "读取图片素材库");
        showMessage(message);
        onError(message);
      });

    return () => {
      cancelled = true;
      Object.values(assetUrlsRef.current).forEach((url) => URL.revokeObjectURL(url));
      assetUrlsRef.current = {};
    };
  }, [activeId, assetRefreshKey, onError]);

  function showMessage(message: string, duration = 3200) {
    if (messageTimerRef.current) window.clearTimeout(messageTimerRef.current);
    setImageMessage(message);
    messageTimerRef.current = window.setTimeout(() => {
      setImageMessage("");
      messageTimerRef.current = null;
    }, duration);
  }

  function setAssetPreview(asset: ImageAsset) {
    const previousUrl = assetUrlsRef.current[asset.id];
    if (previousUrl) URL.revokeObjectURL(previousUrl);
    const nextUrls = { ...assetUrlsRef.current, [asset.id]: URL.createObjectURL(asset.blob) };
    assetUrlsRef.current = nextUrls;
    setAssetUrls(nextUrls);
  }

  async function addImageFiles(files: File[]) {
    if (!activeId) {
      showMessage("请先新建或选择一篇文章");
      return;
    }
    const selected = files.filter((file) => file.type.startsWith("image/")).slice(0, 10);
    if (!selected.length) return;
    setImageProcessing(true);
    try {
      const added: ImageAsset[] = [];
      for (const file of selected) {
        const defaultAlt = file.name.replace(/\.[^.]+$/, "").trim() || "文章图片";
        const asset = await compressImageFile(file, activeId, file.name || "粘贴图片", {}, undefined, defaultAlt);
        await putImageAsset(asset);
        added.push(asset);
        setAssetPreview(asset);
      }
      setImageAssets((items) => [...items, ...added]);
      insertBlock(added.map((asset) => `![${asset.alt}](asset://${asset.id})`).join("\n\n"));
      const originalSize = added.reduce((total, asset) => total + asset.originalSize, 0);
      const compressedSize = added.reduce((total, asset) => total + asset.compressedSize, 0);
      showMessage(`已添加 ${added.length} 张图片：${formatBytes(originalSize)} → ${formatBytes(compressedSize)}`);
    } catch (error) {
      reportError(error, "添加图片");
    } finally {
      setImageProcessing(false);
    }
  }

  function handleImageInput(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    void addImageFiles(files);
  }

  function handleEditorDrop(event: ReactDragEvent<HTMLTextAreaElement>) {
    const files = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith("image/"));
    setDragActive(false);
    if (!files.length) return;
    event.preventDefault();
    void addImageFiles(files);
  }

  function beginReplaceImage(id: string) {
    setReplaceAssetId(id);
    replaceImageInputRef.current?.click();
  }

  async function handleReplaceImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    const current = imageAssets.find((asset) => asset.id === replaceAssetId);
    setReplaceAssetId(null);
    if (!file || !current) return;
    setImageProcessing(true);
    try {
      const replacement = await compressImageFile(file, current.articleId, file.name, {}, current.id, current.alt);
      const asset = { ...replacement, createdAt: current.createdAt };
      await putImageAsset(asset);
      setImageAssets((items) => items.map((item) => (item.id === asset.id ? asset : item)));
      setAssetPreview(asset);
      showMessage(`已替换 ${asset.id}：${formatBytes(asset.originalSize)} → ${formatBytes(asset.compressedSize)}`);
    } catch (error) {
      reportError(error, "替换图片");
    } finally {
      setImageProcessing(false);
    }
  }

  async function recompressImage(asset: ImageAsset) {
    if (asset.type === "image/gif") {
      showMessage("GIF 为保留动画不会重新压缩");
      return;
    }
    setImageProcessing(true);
    try {
      const result = await compressImageFile(
        asset.blob,
        asset.articleId,
        asset.name,
        { maxWidth: 960, quality: 0.74 },
        asset.id,
        asset.alt,
      );
      const optimized = { ...result, originalSize: asset.originalSize, createdAt: asset.createdAt };
      await putImageAsset(optimized);
      setImageAssets((items) => items.map((item) => (item.id === optimized.id ? optimized : item)));
      setAssetPreview(optimized);
      showMessage(`已节省空间：${formatBytes(asset.compressedSize)} → ${formatBytes(optimized.compressedSize)}`);
    } catch (error) {
      reportError(error, "重新压缩图片");
    } finally {
      setImageProcessing(false);
    }
  }

  function updateImageAlt(id: string, value: string) {
    const alt = value.replace(/[\]\r\n]/g, " ").slice(0, 120);
    setImageAssets((items) => items.map((asset) => (asset.id === id ? { ...asset, alt } : asset)));
    const pattern = new RegExp(`!\\[[^\\]]*\\]\\(asset:\\/\\/${escapeRegExp(id)}\\)`, "g");
    setMarkdown((content) => content.replace(pattern, () => `![${alt}](asset://${id})`));
  }

  async function saveImageAlt(id: string) {
    const asset = imageAssets.find((item) => item.id === id);
    if (!asset) return;
    try {
      await putImageAsset(asset);
      showMessage("图片说明已保存", 1600);
    } catch (error) {
      reportError(error, "保存图片说明");
    }
  }

  function insertExistingImage(asset: ImageAsset) {
    insertBlock(`![${asset.alt}](asset://${asset.id})`);
    showMessage(`已插入 ${asset.id}`, 1600);
  }

  async function removeImage(asset: ImageAsset) {
    if (!window.confirm(`确定删除图片 ${asset.id} 吗？正文中的对应引用也会被移除。`)) return;
    try {
      await deleteImageAsset(asset.id);
      const previewUrl = assetUrlsRef.current[asset.id];
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      const nextUrls = { ...assetUrlsRef.current };
      delete nextUrls[asset.id];
      assetUrlsRef.current = nextUrls;
      setAssetUrls(nextUrls);
      setImageAssets((items) => items.filter((item) => item.id !== asset.id));
      const pattern = new RegExp(`\\n{0,2}!\\[[^\\]]*\\]\\(asset:\\/\\/${escapeRegExp(asset.id)}\\)\\n{0,2}`, "g");
      setMarkdown((content) => content.replace(pattern, "\n\n").replace(/\n{3,}/g, "\n\n"));
      showMessage("图片已删除", 1600);
    } catch (error) {
      reportError(error, "删除图片");
    }
  }

  function downloadImage(asset: ImageAsset) {
    const url = assetUrlsRef.current[asset.id] ?? URL.createObjectURL(asset.blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = asset.name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    if (!assetUrlsRef.current[asset.id]) URL.revokeObjectURL(url);
  }

  function reportError(error: unknown, action: string) {
    const message = describeStorageError(error, action);
    showMessage(message);
    onError(message);
  }

  return {
    imageAssets,
    assetUrls,
    assetLibraryReady,
    imageProcessing,
    imageMessage,
    addImageFiles,
    handleImageInput,
    handleEditorDrop,
    handleReplaceImage,
    beginReplaceImage,
    recompressImage,
    updateImageAlt,
    saveImageAlt,
    insertExistingImage,
    removeImage,
    downloadImage,
    refreshAssets: () => setAssetRefreshKey((key) => key + 1),
  };
}
