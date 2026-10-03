import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readOwnedCache } from './ownedRead.ts';

type Envelope = { version: 1; items: string[] };
const accepts = (value: unknown): value is Envelope => typeof value === 'object' && value !== null
  && (value as Envelope).version === 1 && Array.isArray((value as Envelope).items)
  && (value as Envelope).items.every(item => typeof item === 'string');

test('owned cache distinguishes no key and a valid empty collection from unreadable or incompatible material', () => {
  assert.equal(readOwnedCache(null, accepts), null);
  assert.deepEqual(readOwnedCache('{"version":1,"items":[]}', accepts), { version: 1, items: [] });
  assert.deepEqual(readOwnedCache('{"version":1,"items":["café"]}', accepts)?.items, ['café']);
  for (const raw of ['', '{', 'null', '{"version":2,"items":[]}', '{"version":1,"items":[42]}']) {
    assert.throws(() => readOwnedCache(raw, accepts));
  }
});

test('bookmark and pack mutations cannot replace unreadable owned material with an empty fallback', () => {
  for (const [path, start, end] of [
    ['../bookmarks/store.ts', 'async function readItems(', '/**\n * The envelope'],
    ['../conversationPacks/store.ts', 'async function read(', '/** Packs are server-owned'],
  ] as const) {
    const source = readFileSync(new URL(path, import.meta.url), 'utf8');
    const read = source.slice(source.indexOf(start), source.indexOf(end, source.indexOf(start)));
    assert.match(read, /readOwnedCache/);
    assert.doesNotMatch(read, /catch|filter\(isItem\)/);
    assert.match(source, /(?:const key = KEY\(\)|key: KEY\(\))/);
    assert.match(source, /scopeGeneration\(\)/);
    assert.match(source, /(?:writeInUserScope|setItemInUserScope)/);
  }
});
