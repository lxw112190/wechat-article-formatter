export type CodeCleanMode = "safe" | "compact";

export type CodeCleanOptions = { mode?: CodeCleanMode; trimTrailingWhitespace?: boolean };

export function cleanCode(code: string, options: CodeCleanOptions = {}) {
  const mode = options.mode ?? "safe";
  let value = code.replace(/\r\n?/g, "\n");
  value = value.replace(/^\n+|\n+$/g, "");
  if (options.trimTrailingWhitespace !== false)
    value = value
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n");
  if (mode === "compact") value = value.replace(/\n{3,}/g, "\n\n");
  return value;
}

export function cleanCodeBlock(markdown: string, start: number, end: number, options?: CodeCleanOptions) {
  return markdown.slice(0, start) + cleanCode(markdown.slice(start, end), options) + markdown.slice(end);
}
