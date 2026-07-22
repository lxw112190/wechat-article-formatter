import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const pasteTurndownService = new TurndownService({
  headingStyle: "atx",
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  fence: "```",
  emDelimiter: "*",
  strongDelimiter: "**",
  linkStyle: "inlined",
});
pasteTurndownService.use(gfm);
pasteTurndownService.keep(["details", "summary", "sub", "sup"]);

const listMarkerPattern = /^\s*(?:(\d+|[a-zA-Z]|[ivxlcdmIVXLCDM]+)[.)、]|[•·▪◦‣⁃o])\s*/;

function stripLeadingListMarker(element: HTMLElement) {
  const nodes: Node[] = [...element.childNodes];
  while (nodes.length) {
    const node = nodes.shift();
    if (!node) continue;
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim()) {
      node.textContent = node.textContent.replace(listMarkerPattern, "");
      return;
    }
    nodes.unshift(...node.childNodes);
  }
}

function normalizeOfficeLists(root: HTMLElement) {
  const parents = [root, ...root.querySelectorAll<HTMLElement>("*")];
  parents.forEach((parent) => {
    let activeList: HTMLOListElement | HTMLUListElement | null = null;
    let activeType = "";
    [...parent.children].forEach((child) => {
      if (!(child instanceof HTMLElement)) return;
      const style = child.getAttribute("style") ?? "";
      const isOfficeList = /MsoListParagraph/i.test(child.className) || /mso-list/i.test(style);
      if (!isOfficeList) {
        activeList = null;
        activeType = "";
        return;
      }

      const ignoredMarkers = [...child.querySelectorAll<HTMLElement>("span")].filter((span) =>
        /mso-list\s*:\s*Ignore/i.test(span.getAttribute("style") ?? ""),
      );
      const markerText = ignoredMarkers.map((span) => span.textContent ?? "").join("") || child.textContent || "";
      const marker = markerText.match(listMarkerPattern);
      const ordered = Boolean(marker?.[1]);
      const type = ordered ? "OL" : "UL";
      if (!activeList || activeType !== type) {
        activeList = document.createElement(ordered ? "ol" : "ul");
        activeType = type;
        if (ordered && marker?.[1] && /^\d+$/.test(marker[1])) (activeList as HTMLOListElement).start = Number(marker[1]);
        parent.insertBefore(activeList, child);
      }

      ignoredMarkers.forEach((span) => span.remove());
      const item = document.createElement("li");
      while (child.firstChild) item.append(child.firstChild);
      if (!ignoredMarkers.length) stripLeadingListMarker(item);
      activeList.append(item);
      child.remove();
    });
  });
}

export function convertPastedHtml(html: string) {
  const source = /Mso|mso-|urn:schemas-microsoft-com:office|<o:/i.test(html) ? "Word" : "网页";
  const sanitized = DOMPurify.sanitize(html, {
    FORBID_TAGS: ["script", "style", "noscript", "iframe", "object", "embed", "form", "button"],
  });
  const container = document.createElement("div");
  container.innerHTML = sanitized;

  container.querySelectorAll<HTMLElement>("[style]").forEach((element) => {
    const style = (element.getAttribute("style") ?? "").toLowerCase();
    if (/display\s*:\s*none|visibility\s*:\s*hidden/.test(style)) {
      element.remove();
      return;
    }
    if (element.tagName !== "SPAN") return;
    const wrappers: Array<"strong" | "em" | "del"> = [];
    if (/font-weight\s*:\s*(?:bold|[6-9]00)/.test(style)) wrappers.push("strong");
    if (/font-style\s*:\s*italic/.test(style)) wrappers.push("em");
    if (/text-decoration[^;]*line-through/.test(style)) wrappers.push("del");
    wrappers.forEach((tag) => {
      const wrapper = document.createElement(tag);
      while (element.firstChild) wrapper.append(element.firstChild);
      element.append(wrapper);
    });
  });

  normalizeOfficeLists(container);

  let skippedImages = 0;
  container.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
    const sourceUrl = (image.getAttribute("src") ?? "").trim();
    if (sourceUrl && !/^(?:file|blob|cid|data):/i.test(sourceUrl)) return;
    const placeholder = document.createElement("span");
    placeholder.textContent = `【图片需重新上传${image.alt ? `：${image.alt}` : ""}】`;
    image.replaceWith(placeholder);
    skippedImages += 1;
  });

  container.querySelectorAll<HTMLElement>("*").forEach((element) => {
    const allowed = new Set<string>();
    if (element.tagName === "A") ["href", "title"].forEach((name) => allowed.add(name));
    if (element.tagName === "IMG") ["src", "alt", "title"].forEach((name) => allowed.add(name));
    if (element.tagName === "TD" || element.tagName === "TH") ["align", "colspan", "rowspan"].forEach((name) => allowed.add(name));
    if (element.tagName === "OL") allowed.add("start");
    if (element.tagName === "INPUT") ["type", "checked", "disabled"].forEach((name) => allowed.add(name));
    if (element.tagName === "PRE" || element.tagName === "CODE") allowed.add("class");
    if (element.tagName === "DETAILS") allowed.add("open");
    element.getAttributeNames().forEach((name) => {
      if (!allowed.has(name)) element.removeAttribute(name);
    });
  });

  container.querySelectorAll("span").forEach((span) => span.replaceWith(...span.childNodes));
  const markdown = pasteTurndownService
    .turndown(container)
    .replace(/^(\s*(?:\d+\.|[-*+]))\s{2,}/gm, "$1 ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return { markdown, skippedImages, source };
}
