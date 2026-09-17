import hljs from "highlight.js/lib/core";
import javascript from "highlight.js/lib/languages/javascript";
import typescript from "highlight.js/lib/languages/typescript";
import xml from "highlight.js/lib/languages/xml";
import css from "highlight.js/lib/languages/css";
import json from "highlight.js/lib/languages/json";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import c from "highlight.js/lib/languages/c";
import cpp from "highlight.js/lib/languages/cpp";
import csharp from "highlight.js/lib/languages/csharp";
import go from "highlight.js/lib/languages/go";
import rust from "highlight.js/lib/languages/rust";
import sql from "highlight.js/lib/languages/sql";
import shell from "highlight.js/lib/languages/shell";
import powershell from "highlight.js/lib/languages/powershell";
import yaml from "highlight.js/lib/languages/yaml";
import markdown from "highlight.js/lib/languages/markdown";
import { normalizeCodeLanguage } from "./codeLanguages";
import { codeHighlightThemes, type CodeHighlightTheme } from "./codeHighlightThemes";
import type { Theme } from "../types";

const languages = {
  javascript,
  typescript,
  xml,
  css,
  json,
  python,
  java,
  c,
  cpp,
  csharp,
  go,
  rust,
  sql,
  shell,
  powershell,
  yaml,
  markdown,
};
Object.entries(languages).forEach(([name, definition]) => hljs.registerLanguage(name, definition));

const classToToken: Record<string, string> = {
  keyword: "keyword",
  string: "string",
  number: "number",
  comment: "comment",
  title: "title",
  built_in: "built_in",
  type: "type",
  variable: "variable",
  meta: "meta",
  tag: "tag",
  name: "tag",
  attr: "attr",
  attribute: "attr",
  regexp: "regexp",
  literal: "keyword",
  params: "variable",
};

function tokenStyle(element: HTMLElement, palette: Record<string, string>) {
  const classes = [...element.classList].map((item) => item.replace(/^hljs-/, ""));
  const key = classes.map((item) => classToToken[item]).find(Boolean);
  if (key && palette[key]) element.style.color = palette[key];
  if (key === "keyword" || key === "built_in" || key === "type") element.style.fontWeight = "600";
  if (key === "comment") element.style.fontStyle = "italic";
  element.dataset.codeToken = key ?? "plain";
}

export function highlightCodeBlocks(root: ParentNode, theme: Theme) {
  const mode = theme.codeHighlightTheme ?? "none";
  if (mode === "none") return 0;
  const palette =
    codeHighlightThemes[theme.codeStyle === "dark" && mode === "github" ? "vscode" : (mode as Exclude<CodeHighlightTheme, "none">)];
  let count = 0;
  root.querySelectorAll<HTMLElement>("pre > code").forEach((code) => {
    const language = normalizeCodeLanguage(code.className.match(/(?:language|lang)-([^\s]+)/)?.[1]);
    if (!language || language === "text" || code.textContent.length > 30000) return;
    const result = hljs.highlight(code.textContent, { language });
    const sanitized = result.value.replace(/<(?!\/?span\b)[^>]*>/gi, "");
    const template = document.createElement("template");
    template.innerHTML = sanitized;
    template.content.querySelectorAll<HTMLElement>("span").forEach((span) => tokenStyle(span, palette));
    code.replaceChildren(...Array.from(template.content.childNodes));
    code.dataset.codeLanguage = language;
    count += 1;
  });
  return count;
}
