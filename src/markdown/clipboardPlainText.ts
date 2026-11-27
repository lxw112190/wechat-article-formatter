import { formatLinkAsPlainText } from "./links";

const blockTags = new Set([
  "ARTICLE",
  "ASIDE",
  "BLOCKQUOTE",
  "DETAILS",
  "DIV",
  "FIGCAPTION",
  "FIGURE",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "HR",
  "OL",
  "P",
  "PRE",
  "SECTION",
  "SUMMARY",
  "TABLE",
  "UL",
]);

function inlineText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return (node.textContent ?? "").replace(/[ \t\r\n\f]+/g, " ");
  if (!(node instanceof HTMLElement)) return "";
  if (node.tagName === "BR") return "\n";
  if (node instanceof HTMLImageElement) return node.alt ? `【图片：${node.alt}】` : "【图片】";
  if (node instanceof HTMLInputElement && node.type === "checkbox") {
    const separator = /^\s/.test(node.nextSibling?.textContent ?? "") ? "" : " ";
    return (node.checked ? "☑" : "☐") + separator;
  }
  const text = Array.from(node.childNodes, inlineText).join("");
  if (node.tagName === "A" && !node.querySelector("img")) {
    const url = node.getAttribute("href") ?? "";
    const next = node.nextSibling?.textContent;
    return formatLinkAsPlainText(text, url) + (url && next && !/^\s/.test(next) ? " " : "");
  }
  return text;
}

function listText(list: HTMLElement): string {
  const ordered = list instanceof HTMLOListElement;
  let index = ordered ? list.start : 1;
  return Array.from(list.children)
    .filter((item) => item.tagName === "LI")
    .map((item) => {
      const marker = ordered ? `${index++}. ` : "• ";
      const content = clipboardPlainText(item, "\n");
      const [first, ...rest] = content.split("\n");
      return [marker + first, ...rest.map((line) => (line ? " ".repeat(marker.length) + line : ""))].join("\n");
    })
    .join("\n");
}

function preformattedText(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return node.textContent ?? "";
  if (node instanceof HTMLBRElement) return "\n";
  return Array.from(node.childNodes, preformattedText).join("");
}

export function clipboardPlainText(root: ParentNode, separator = "\n\n"): string {
  const blocks: string[] = [];
  let flow = "";
  function flush() {
    if (flow.trim()) blocks.push(flow.trim());
    flow = "";
  }
  for (const node of root.childNodes) {
    if (!(node instanceof HTMLElement) || (!blockTags.has(node.tagName) && node.style.display !== "block")) {
      flow += inlineText(node);
      continue;
    }
    flush();
    if (node.tagName === "PRE") {
      const code = preformattedText(node).replace(/\n$/, "");
      if (code) blocks.push(code);
    } else if (node.tagName === "OL" || node.tagName === "UL") {
      const list = listText(node);
      if (list) blocks.push(list);
    } else if (node instanceof HTMLTableElement) {
      const table = Array.from(node.rows, (row) => Array.from(row.cells, (cell) => inlineText(cell).trim()).join(" | ")).join("\n");
      if (table) blocks.push(table);
    } else if (node.tagName === "HR") {
      blocks.push("───");
    } else {
      const text = clipboardPlainText(node);
      if (text) blocks.push(text);
    }
  }
  flush();
  return blocks.join(separator);
}
