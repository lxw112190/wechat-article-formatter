export type CodeLanguage =
  | "text"
  | "javascript"
  | "typescript"
  | "html"
  | "css"
  | "json"
  | "python"
  | "java"
  | "c"
  | "cpp"
  | "csharp"
  | "go"
  | "rust"
  | "sql"
  | "shell"
  | "powershell"
  | "yaml"
  | "markdown";

export const codeLanguages: Array<{ id: CodeLanguage; label: string; aliases: string[] }> = [
  { id: "text", label: "纯文本", aliases: ["text", "txt", "plain", ""] },
  { id: "javascript", label: "JavaScript", aliases: ["javascript", "js", "jsx"] },
  { id: "typescript", label: "TypeScript", aliases: ["typescript", "ts", "tsx"] },
  { id: "html", label: "HTML/XML", aliases: ["html", "xml"] },
  { id: "css", label: "CSS", aliases: ["css"] },
  { id: "json", label: "JSON", aliases: ["json"] },
  { id: "python", label: "Python", aliases: ["python", "py"] },
  { id: "java", label: "Java", aliases: ["java"] },
  { id: "c", label: "C", aliases: ["c"] },
  { id: "cpp", label: "C++", aliases: ["cpp", "c++", "cc", "cxx"] },
  { id: "csharp", label: "C#", aliases: ["csharp", "cs", "c#"] },
  { id: "go", label: "Go", aliases: ["go", "golang"] },
  { id: "rust", label: "Rust", aliases: ["rust", "rs"] },
  { id: "sql", label: "SQL", aliases: ["sql"] },
  { id: "shell", label: "Shell", aliases: ["shell", "sh", "bash", "zsh"] },
  { id: "powershell", label: "PowerShell", aliases: ["powershell", "ps", "ps1"] },
  { id: "yaml", label: "YAML", aliases: ["yaml", "yml"] },
  { id: "markdown", label: "Markdown", aliases: ["markdown", "md"] },
];

const aliasMap = new Map(codeLanguages.flatMap((item) => item.aliases.map((alias) => [alias.toLowerCase(), item.id] as const)));

export function normalizeCodeLanguage(value: string | null | undefined): CodeLanguage | null {
  const normalized = value?.trim().toLowerCase() ?? "";
  return aliasMap.get(normalized) ?? null;
}

export function getCodeLanguageLabel(value: string | null | undefined) {
  const id = normalizeCodeLanguage(value) ?? "text";
  return codeLanguages.find((item) => item.id === id)?.label ?? "纯文本";
}
