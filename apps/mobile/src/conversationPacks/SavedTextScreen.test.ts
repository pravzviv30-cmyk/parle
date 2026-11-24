import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const screen = readFileSync(new URL('./SavedTextScreen.tsx', import.meta.url), 'utf8');

test('saved text keeps read failures distinct from an empty opt-in list', () => {
  assert.match(screen, /rows === null \? <Text[^>]+>\{message \? 'The saved text could not be loaded\.' : 'Loading saved text…'\}/);
  assert.match(screen, /rows\.length === 0 \? <Text[^>]+>No conversation text saved\./);
  assert.match(screen, /rows === null && message != null && <IconAction layout="inline" icon="refresh" label="Try again"/);
  assert.match(screen, /scope !== scopeGeneration\(\) \|\| user\?\.id !== ownerId/);
});

test('saved text labels real preview, date and deletion scope', () => {
  assert.match(screen, /row\.lines\[0\]\.frWritten \?\? row\.lines\[0\]\.fr/);
  assert.match(screen, /new Date\(row\.savedAt\)\.toLocaleDateString\(\)/);
  assert.match(screen, /Your curated phrases, corrections and practice stay\./);
  assert.match(screen, /No recordings are kept here\./);
});

test('saved text offers Try again only after a read failed', () => {
  const retry = screen.split('\n').find(line => line.includes('label="Try again"'))!;
  assert.match(screen, /useState<string \| null>\(null\)/, 'the message starts unset while loading');
  assert.match(retry, /message != null/, 'Try again shows beside "Loading saved text…" because null is not the empty string');
  assert.doesNotMatch(retry, /message !== ''/);
});

const library = readFileSync(new URL('./ConversationPackLibrary.tsx', import.meta.url), 'utf8');
const conversations = readFileSync(new URL('./ConversationsScreen.tsx', import.meta.url), 'utf8');
const routes = readFileSync(new URL('../nav/types.ts', import.meta.url), 'utf8');

test("a conversation's saved text opens on that conversation", () => {
  assert.match(routes, /SavedConversationText: \{ sessionId\?: string \} \| undefined;/);
  assert.match(screen, /route\.params\?\.sessionId/, 'the screen ignores which conversation it was opened for');
  assert.match(screen, /findText\(user, adapter, wanted\)/);
  assert.match(screen, /&& value\) setSelected\(current => current \?\? value\)/, 'a found conversation does not open');
  assert.match(screen, /const exit = \(\) => \{ if \(selected\) \{ setSelected\(null\)/, 'back from the conversation goes to the list');
  assert.match(library, /onSavedText !== undefined && <IconAction layout="inline" icon="document" label="Saved conversation text"[^>]*onPress=\{\(\) => onSavedText\(selected\)\}/, 'the opened conversation has no door to its saved text');
  assert.match(conversations, /onSavedText=\{adapter\.kind === 'supabase' \? \(pack\) => nav\.navigate\('SavedConversationText', \{ sessionId: pack\.sessionId \}\) : undefined\}/, 'the door is drawn on a build with no saved text');
});

test('a conversation opens only over a loaded list, so a list failure keeps Try again and a delete never invents an empty list', () => {
  const list = screen.indexOf('listText(user, adapter).then'), rowsSet = screen.indexOf('setRows(result.value.conversations)');
  const find = screen.indexOf('findText(user, adapter, wanted)'), select = screen.indexOf('setSelected(current => current ?? value)');
  assert.ok(list > -1 && rowsSet > list && find > rowsSet && select > find, 'the conversation must open only after page 1 of the list is set');
  assert.match(screen, /current\?\.filter\(row => row\.sessionId !== sessionId\) \?\? null/, 'a delete with no loaded list must leave it unloaded, not empty');
});

test('the requested conversation opens once: any finished lookup clears it, so a refocus shows the list', () => {
  assert.match(screen, /\.finally\(\(\) => \{ if \(opening\.current === wanted\) opening\.current = undefined; \}\)/);
});
