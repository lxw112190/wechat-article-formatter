export const localAssetPattern = /!\[([^\]]*)\]\(asset:\/\/([A-Za-z0-9-]+)\)/g;

export function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export function prepareAssetMarkdown(markdown: string) {
  return markdown.replace(
    localAssetPattern,
    (_match, alt: string, id: string) => `<img data-asset-id="${escapeHtml(id)}" alt="${escapeHtml(alt)}">`,
  );
}

export function getLocalAssetReferences(markdown: string) {
  const references: Array<{ id: string; alt: string }> = [];
  const seen = new Set<string>();
  for (const match of markdown.matchAll(localAssetPattern)) {
    const id = match[2];
    if (seen.has(id)) continue;
    seen.add(id);
    references.push({ id, alt: match[1] });
  }
  return references;
}

export function getReferencedAssetIds(markdowns: string[]) {
  return new Set(markdowns.flatMap((markdown) => getLocalAssetReferences(markdown).map((item) => item.id)));
}
