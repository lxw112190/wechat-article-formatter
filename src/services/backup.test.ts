import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import type { ImageAsset } from "../imageAssets";
import { backupFormat, backupVersion, createCompleteBackup, readCompleteBackup } from "./backup";

const article = {
  id: "article-1",
  title: "备份测试",
  markdown: "# 备份测试\n\n![图片](asset://IMG-TEST)",
  updatedAt: "2026-07-22T00:00:00.000Z",
};
const asset: ImageAsset = {
  id: "IMG-TEST",
  articleId: article.id,
  name: "IMG-TEST.png",
  type: "image/png",
  blob: new Blob([new Uint8Array([137, 80, 78, 71])], { type: "image/png" }),
  originalSize: 4,
  compressedSize: 4,
  width: 10,
  height: 10,
  alt: "图片",
  createdAt: "2026-07-22T00:00:00.000Z",
};

describe("complete ZIP backup", () => {
  it("round-trips articles, history, settings and images", async () => {
    const bytes = await createCompleteBackup(
      {
        articles: [article],
        history: [{ id: "version-1", articleId: article.id, title: article.title, markdown: article.markdown, savedAt: article.updatedAt }],
        assets: [asset],
        settings: { themeId: "ink", syncScroll: false, outlineOpen: true },
      },
      "0.1.0",
    );
    const restored = await readCompleteBackup(bytes);
    expect(restored.manifest.format).toBe(backupFormat);
    expect(restored.manifest.version).toBe(backupVersion);
    expect(restored.articles).toEqual([article]);
    expect(restored.history).toHaveLength(1);
    expect(restored.settings).toEqual({ themeId: "ink", syncScroll: false, outlineOpen: true });
    expect(restored.assets[0].id).toBe(asset.id);
    expect(new Uint8Array(await restored.assets[0].blob.arrayBuffer())).toEqual(new Uint8Array([137, 80, 78, 71]));
  });

  it("rejects backups from a newer format version", async () => {
    const bytes = await createCompleteBackup(
      { articles: [article], history: [], assets: [], settings: { themeId: "wechat", syncScroll: true, outlineOpen: true } },
      "0.1.0",
    );
    const zip = await JSZip.loadAsync(bytes);
    const manifest = JSON.parse(await zip.file("manifest.json")!.async("string"));
    manifest.version = backupVersion + 1;
    zip.file("manifest.json", JSON.stringify(manifest));
    const newerBytes = await zip.generateAsync({ type: "uint8array" });
    await expect(readCompleteBackup(newerBytes)).rejects.toThrow("请升级工具后恢复");
  });
});
