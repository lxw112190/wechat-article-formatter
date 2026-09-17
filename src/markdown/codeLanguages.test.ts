import { describe, expect, it } from "vitest";
import { normalizeCodeLanguage } from "./codeLanguages";

describe("normalizeCodeLanguage", () => {
  it.each([
    ["js", "javascript"],
    ["TS", "typescript"],
    ["c++", "cpp"],
    ["py", "python"],
    ["", "text"],
  ])("maps %s", (input, expected) => {
    expect(normalizeCodeLanguage(input)).toBe(expected);
  });
  it("returns null for unknown aliases", () => expect(normalizeCodeLanguage("wat")).toBeNull());
});
