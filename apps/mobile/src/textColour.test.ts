/**
 * Every Text says its colour (2026-11-06, the founder's dark marks). The type
 * roles in theme.ts carry no colour, so a Text styled only by `type.x` draws
 * the platform's black, which is 1.35 on the dark card. Onboarding is pinned
 * light by rule (nav/darkReady.ts), so it is left out.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';

const ROOT = new URL('.', import.meta.url);

/**
 * The line of each outermost Text whose style names a type or bType role and
 * no colour: none inline, and no named style (`st.x`) that sets one or hides
 * the words (`opacity: 0`). A Text inside another Text inherits its colour.
 */
function bareTexts(source: string): number[] {
  const hits: number[] = [];
  const tags = /<Text\b|<\/Text>/g;
  let depth = 0;
  let m: RegExpExecArray | null;
  while ((m = tags.exec(source))) {
    if (m[0] === '</Text>') { depth = Math.max(0, depth - 1); continue; }
    let end = m.index + 5;
    for (let brace = 0; end < source.length; end++) {
      const c = source[end];
      if (c === '{') brace++;
      else if (c === '}') brace--;
      else if (c === '>' && brace === 0) break;
    }
    const tag = source.slice(m.index, end + 1);
    const at = tag.indexOf('style={');
    if (at >= 0 && depth === 0) {
      let close = at + 7;
      for (let brace = 1; close < tag.length && brace > 0; close++) brace += tag[close] === '{' ? 1 : tag[close] === '}' ? -1 : 0;
      const value = tag.slice(at + 7, close - 1);
      const named = [...value.matchAll(/\b(?!(?:type|bType)\b)\w+\.(\w+)/g)].some(([, key]) => new RegExp(`\\b${key}:\\s*\\{[^}]*\\b(?:color:|opacity: 0\\b)`).test(source));
      if (/\b(?:type|bType)\.\w+/.test(value) && !/\bcolor\b/.test(value) && !named) hits.push(source.slice(0, m.index).split('\n').length);
    }
    if (!tag.endsWith('/>')) depth++;
    tags.lastIndex = end + 1;
  }
  return hits;
}

// 2026-11-07 push-check: the scan missed an arrow earlier in the tag, bType
// roles and arrays with a named style, so it checks itself on samples first.
test('the scan finds every uncoloured Text shape and passes the coloured ones', () => {
  const bad = [
    '<Text onPress={() => go()} style={type.body}>a</Text>',
    '<Text style={bType.meta}>a</Text>',
    '<Text style={[type.small, st.gap]}>a</Text>',
  ];
  for (const sample of bad) assert.equal(bareTexts(sample).length, 1, sample);
  const good = [
    '<Text style={[type.body, { color: t.text }]}>a</Text>',
    '<Text style={[type.small, st.ink]}>a</Text>\nconst st = { ink: { color: t.text } };',
    '<Text style={[type.body, { color: t.text }]}>a <Text style={type.bodyStrong}>b</Text></Text>',
  ];
  for (const sample of good) assert.deepEqual(bareTexts(sample), [], sample);
});

test('no Text is styled only by a type role, so none draws black in dark', () => {
  const found: string[] = [];
  const files = readdirSync(ROOT, { recursive: true, encoding: 'utf8' })
    .map((p) => p.split('\\').join('/'))
    .filter((p) => p.endsWith('.tsx') && !/\.test\.tsx$/.test(p) && !p.startsWith('onboarding/') && !p.startsWith('testing/'));
  for (const file of files) {
    const source = readFileSync(new URL(file, ROOT), 'utf8');
    for (const line of bareTexts(source)) found.push(`${file}:${line}`);
  }
  assert.deepEqual(found, [], `a Text with no colour: ${found.join(', ')}`);
});
