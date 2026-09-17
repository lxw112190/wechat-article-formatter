import { describe, expect, it } from "vitest";
import { findCodeBlockAtPosition } from "./codeBlock";

describe("findCodeBlockAtPosition", () => {
  it("finds fenced blocks and language", () => {
    const markdown = "前言\n\n```ts\nconst x = 1;\n```\n\n结尾";
    const block = findCodeBlockAtPosition(markdown, markdown.indexOf("const"));
    expect(block?.language).toBe("typescript");
    expect(block?.code).toContain("const x");
  });
  it("returns null outside block", () => expect(findCodeBlockAtPosition("```js\na\n```", 0)).not.toBeNull());
});
