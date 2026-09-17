import { describe, expect, it } from "vitest";
import { cleanCode } from "./codeCleaner";

describe("cleanCode", () => {
  it("normalizes line endings and preserves indentation", () => {
    expect(cleanCode("\r\n  const x = 1;  \r\n\r\n")).toBe("  const x = 1;");
  });
  it("supports compact mode", () => expect(cleanCode("a\n\n\n\nb", { mode: "compact" })).toBe("a\n\nb"));
});
