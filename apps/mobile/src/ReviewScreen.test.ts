import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./ReviewScreen.tsx', import.meta.url)), 'utf8');

describe('ReviewScreen, a deck that cannot be read (F1154)', () => {
  test('review shows a way out when the deck cannot be read', () => {
    const load = src.slice(src.indexOf('void Promise.all([loadDeck(), '), src.indexOf('return () => {'));
    // A failed read, or a throw while dealing it, marks the sitting unread.
    assert.match(load, /\}\)\.catch\(\(\) => \{\s*if \(!cancelled\) setUnread\(true\);\s*\}\);/);
    // The unread card comes before the spinner, with the Drill words and a Done.
    const unread = src.indexOf('if (unread)');
    assert.ok(unread > 0 && unread < src.indexOf('if (queue === null)'), 'the unread card must be drawn before the spinner');
    const card = src.slice(unread, src.indexOf('if (queue === null)'));
    assert.match(card, /DRILL_UNREAD\.title/);
    assert.match(card, /DRILL_UNREAD\.body/);
    assert.match(card, /<EndActions done=\{\{ label: 'Done', onPress: onDone \}\} \/>/);
    // Placed as the other end cards are.
    assert.match(card, /<View style=\{st\.ending\}>\s*<Text accessibilityRole="header"[^]*DRILL_UNREAD\.body\}<\/Text>\s*<\/View>/);
  });

  test('a corrupt packs cache does not stop the deck from being reviewed', () => {
    assert.match(src, /void Promise\.all\(\[loadDeck\(\), loadConversationPacks\(\)\.catch\(\(\) => \[\]\)\]\)/);
  });
});
