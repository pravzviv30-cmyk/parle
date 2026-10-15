/**
 * Inline SVG definition IDs share the web document. Figma's 64 and 88 px orb
 * exports reuse paint IDs, so each mounted drawing needs its own ID namespace.
 * The bundled exports stay byte-for-byte unchanged; this only scopes references
 * when SvgXml renders them, without changing paths, paint values or geometry.
 */
export function c2SvgForInstance(xml: string, instanceId: string): string {
  const prefix = `c2_${instanceId.replace(/[^a-zA-Z0-9_-]/g, '_')}_`;
  const ids = new Map<string, string>();
  let scoped = xml.replace(/\bid="([^"]+)"/g, (_, id: string) => {
    const name = `${prefix}${ids.size}`;
    ids.set(id, name);
    return `id="${name}"`;
  });
  scoped = scoped.replace(/url\(#([^)]*)\)/g, (original, id: string) => ids.has(id) ? `url(#${ids.get(id)})` : original);
  return scoped.replace(/\b((?:xlink:)?href)="#([^"]+)"/g, (original, attribute: string, id: string) => ids.has(id) ? `${attribute}="#${ids.get(id)}"` : original);
}
