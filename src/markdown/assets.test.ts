import { describe, expect, it } from "vitest";
import { getLocalAssetReferences, getReferencedAssetIds, prepareAssetMarkdown } from "./assets";

describe("local image references", () => {
  it("replaces local image syntax with safe asset elements", () => {
    expect(prepareAssetMarkdown("![封面<script>](asset://IMG-ABC123)")).toBe('<img data-asset-id="IMG-ABC123" alt="封面&lt;script&gt;">');
  });

  it("deduplicates references while preserving order", () => {
    const markdown = "![甲](asset://IMG-A)\n![重复](asset://IMG-A)\n![乙](asset://IMG-B)";
    expect(getLocalAssetReferences(markdown)).toEqual([
      { id: "IMG-A", alt: "甲" },
      { id: "IMG-B", alt: "乙" },
    ]);
  });

  it("collects references across articles", () => {
    expect([...getReferencedAssetIds(["![](asset://IMG-A)", "![](asset://IMG-B)\n![](asset://IMG-A)"])]).toEqual(["IMG-A", "IMG-B"]);
  });
});
