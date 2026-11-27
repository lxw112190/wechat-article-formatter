import type { Theme } from "../types";
import { classifyLink, formatLinkAsPlainText } from "./links";
import { getThemeFontFamily } from "./renderMarkdown";

function copyNodesWithoutNestedList(item: HTMLLIElement) {
  const wrapper = document.createElement("span");
  Array.from(item.childNodes).forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE && ["UL", "OL"].includes((node as Element).tagName)) return;
    if (node.nodeType === Node.ELEMENT_NODE && (node as Element).tagName === "P")
      wrapper.append(...Array.from(node.childNodes).map((child) => child.cloneNode(true)));
    else wrapper.append(node.cloneNode(true));
  });
  return wrapper;
}

function flattenList(list: HTMLUListElement | HTMLOListElement, theme: Theme, depth: number, path: number[], output: HTMLElement[]) {
  const ordered = list.tagName === "OL";
  const items = Array.from(list.children).filter((child): child is HTMLLIElement => child.tagName === "LI");
  items.forEach((item, index) => {
    const currentPath = [...path, index + 1];
    const marker = ordered ? `${currentPath.join(".")}. ` : `${depth === 0 ? "•" : depth === 1 ? "◦" : "▪"} `;
    const paragraph = document.createElement("p");
    paragraph.setAttribute(
      "style",
      `margin:0 0 ${theme.listSpacing}px;padding-left:${depth * 20}px;color:${theme.text};font-family:${getThemeFontFamily(theme)};font-size:${theme.bodyFontSize}px;line-height:${theme.bodyLineHeight};text-indent:0;word-break:break-word;`,
    );
    paragraph.append(document.createTextNode(marker), copyNodesWithoutNestedList(item));
    output.push(paragraph);
    Array.from(item.children)
      .filter((child): child is HTMLUListElement | HTMLOListElement => child.tagName === "UL" || child.tagName === "OL")
      .forEach((nested) => flattenList(nested, theme, depth + 1, currentPath, output));
  });
}

export function flattenNestedListsForWechat(root: DocumentFragment, theme: Theme) {
  const lists = Array.from(root.querySelectorAll<HTMLUListElement | HTMLOListElement>("ul,ol")).filter(
    (list) => !list.parentElement?.closest("ul,ol"),
  );
  lists.forEach((list) => {
    if (!list.querySelector(":scope > li > ul, :scope > li > ol")) return;
    const blocks: HTMLElement[] = [];
    flattenList(list, theme, 0, [], blocks);
    list.replaceWith(...blocks);
  });
}

export function prepareWechatHtml(bodyHtml: string, theme: Theme) {
  const template = document.createElement("template");
  template.innerHTML = bodyHtml;
  template.content.querySelectorAll<HTMLParagraphElement>("p[data-image-placeholder]").forEach((placeholder) => {
    const before = placeholder.previousElementSibling;
    if (before instanceof HTMLParagraphElement && Number.parseFloat(before.style.marginBottom) > 8) before.style.marginBottom = "8px";
    const after = placeholder.nextElementSibling;
    if (after instanceof HTMLHeadingElement && Number.parseFloat(after.style.marginTop) > 12) after.style.marginTop = "12px";
    placeholder.removeAttribute("data-image-placeholder");
  });
  template.content.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((link) => {
    const href = link.getAttribute("href")?.trim() ?? "";
    if (!href || classifyLink(href) !== "wechat-article") {
      if (link.querySelector("img")) {
        link.replaceWith(...link.childNodes);
        return;
      }
      const [label, url] = formatLinkAsPlainText(link.textContent ?? "", href).split("\n");
      const next = link.nextSibling?.textContent;
      const separator = href && next && !/^\s/.test(next) ? "\u00a0" : "";
      if (url) link.replaceWith(label, document.createElement("br"), url + separator);
      else link.replaceWith(label + separator);
      return;
    }
    link.removeAttribute("rel");
  });
  template.content.querySelectorAll<HTMLInputElement>('input[type="checkbox"]').forEach((input) => {
    input.replaceWith(document.createTextNode(input.checked ? "☑ " : "☐ "));
  });
  template.content.querySelectorAll<HTMLElement>("figcaption").forEach((caption) => {
    const paragraph = document.createElement("p");
    paragraph.setAttribute(
      "style",
      `margin:8px 0 0;text-align:${theme.imageCaptionAlign};text-indent:0;color:${theme.muted};font-size:${theme.imageCaptionSize}px;line-height:1.6;`,
    );
    paragraph.append(...caption.childNodes);
    caption.replaceWith(paragraph);
  });
  template.content.querySelectorAll<HTMLElement>("*").forEach((element) => {
    [...element.attributes]
      .filter((attribute) => attribute.name.startsWith("data-code-"))
      .forEach((attribute) => element.removeAttribute(attribute.name));
  });
  flattenNestedListsForWechat(template.content, theme);
  return template.innerHTML;
}
