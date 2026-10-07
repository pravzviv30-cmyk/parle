import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import ts from 'typescript';
const root = fileURLToPath(new URL('../', import.meta.url));
const allowed = JSON.parse(readFileSync(new URL('./ghostLinks.json', import.meta.url), 'utf8')) as { file: string; label: string }[];
const key = (file: string, label: string) => `${file}:${label}`;
const GHOST_CEILING = 60;
function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(dir, entry.name)) : entry.name.endsWith('.tsx') ? [path.join(dir, entry.name)] : []);
}
test('underlined text links remain only where words must stay: legal, billing, account, decline and leave', () => {
  const permitted = new Map<string, number>();
  for (const row of allowed) permitted.set(key(row.file, row.label), (permitted.get(key(row.file, row.label)) ?? 0) + 1);
  let ghosts = 0;
  for (const file of [...files(root), path.join(root, '../App.tsx')]) {
    const relative = path.relative(root, file).replace('../App.tsx', 'App.tsx');
    const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const visit = (node: ts.Node) => {
      if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
        const name = node.tagName.getText(source);
        const props = node.attributes.properties;
        const label = props.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'label');
        if (['IconAction', 'IconButton'].includes(name)) assert.ok(label, `${relative}: ${name} needs its own label`);
        if (name === 'GhostButton') {
          ghosts++;
          const labelText = label && ts.isJsxAttribute(label) ? label.initializer?.getText(source) : undefined;
          const id = key(relative, labelText ?? '');
          assert.ok((permitted.get(id) ?? 0) > 0, `${id}: ordinary actions use the icon controls`);
          permitted.set(id, permitted.get(id)! - 1);
        }
        if (name === 'IconButton') {
          const icon = props.find(p => ts.isJsxAttribute(p) && p.name.getText(source) === 'icon');
          assert.ok(icon && ts.isJsxAttribute(icon) && icon.initializer, `${relative}: missing icon`);
          if (icon && ts.isJsxAttribute(icon) && icon.initializer && ts.isStringLiteral(icon.initializer))
            assert.ok(['back','close','speaker','bookmark','replay','bell'].includes(icon.initializer.text), `${relative}: unsupported unlabelled mark`);
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  assert.ok(ghosts <= GHOST_CEILING, `${ghosts} underlined controls exceed ${GHOST_CEILING}`);
});
