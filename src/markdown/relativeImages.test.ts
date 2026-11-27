import { describe, expect, it } from "vitest";
import { getLocalAssetReferences } from "./assets";
import { associateRelativeImage, getRelativeImageReferences } from "./relativeImages";

describe("relative Markdown images", () => {
  it("associates repeated and reference-style images without touching code, links or remote images", () => {
    const image = "![本地图 \\] 注释](images/cover.png)";
    const source = [
      image,
      "",
      "> ![另一张][cover]",
      "",
      "[cover]: images/cover.png",
      "[下载][cover]",
      "![远程](https://example.com/cover.png)",
      "![协议相对](//example.com/cover.png)",
      "",
      "~~~md",
      image,
      "~~~",
    ].join("\n");
    expect(getRelativeImageReferences(source)).toEqual([{ path: "images/cover.png", alt: "本地图 ] 注释" }]);
    const linked = associateRelativeImage(source, "images/cover.png", "IMG-COVER");
    expect(getLocalAssetReferences(linked)).toEqual([{ id: "IMG-COVER", alt: "本地图 ] 注释" }]);
    expect(linked).toContain("> ![另一张](asset://IMG-COVER)");
    expect(linked).toContain("[下载][cover]");
    expect(linked).toContain(`~~~md\n${image}\n~~~`);
    expect(getRelativeImageReferences(linked)).toEqual([]);
  });
});
