import { marked } from "marked";
import type { Tokens } from "marked";
import { formatAssetImage } from "./assets";

export type RelativeImageReference = { path: string; alt: string };

export function isRelativeImagePath(path: string) {
  const source = path.trim();
  return Boolean(source && !source.startsWith("//") && !/^[a-z][\w+.-]*:/i.test(source));
}

function imageTokens(markdown: string) {
  const images: Tokens.Image[] = [];
  marked.walkTokens(marked.lexer(markdown), (token) => {
    if (token.type === "image") images.push(token as Tokens.Image);
  });
  return images;
}

export function getRelativeImageReferences(markdown: string): RelativeImageReference[] {
  const references = new Map<string, RelativeImageReference>();
  for (const { href, text } of imageTokens(markdown)) {
    if (isRelativeImagePath(href) && !references.has(href)) references.set(href, { path: href, alt: text });
  }
  return [...references.values()];
}

export function associateRelativeImage(markdown: string, path: string, assetId: string) {
  const matches = new Map(
    imageTokens(markdown)
      .filter((image) => image.href === path)
      .map((image) => [image.raw, image.text]),
  );
  if (!matches.size) return markdown;

  // Re-lex the candidates so an identical image example inside code is left intact.
  const candidates: Array<{ start: number; raw: string; alt: string }> = [];
  for (const [raw, alt] of matches) {
    for (let start = markdown.indexOf(raw); start !== -1; start = markdown.indexOf(raw, start + raw.length)) {
      candidates.push({ start, raw, alt });
    }
  }
  candidates.sort((left, right) => left.start - right.start || right.raw.length - left.raw.length);
  const prefix = `${assetId}-probe-`;
  function replace(valid?: Set<string>) {
    let cursor = 0;
    const parts: string[] = [];
    candidates.forEach(({ start, raw, alt }, index) => {
      const probe = `${prefix}${index}`;
      if (start < cursor || (valid && !valid.has(probe))) return;
      parts.push(markdown.slice(cursor, start), formatAssetImage(alt, valid ? assetId : probe));
      cursor = start + raw.length;
    });
    return parts.join("") + markdown.slice(cursor);
  }
  const valid = new Set(
    imageTokens(replace())
      .filter(({ href }) => href.startsWith(`asset://${prefix}`))
      .map(({ href }) => href.slice("asset://".length)),
  );
  return replace(valid);
}
