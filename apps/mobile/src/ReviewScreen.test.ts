import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const src = readFileSync(fileURLToPath(new URL('./ReviewScreen.tsx', import.meta.url)), 'utf8');

describe('ReviewScreen, a deck that cannot be read (F1154)', () => {
  test('review shows a way out when the deck cannot be read', () => {
    const load = src.slice(src.indexOf('void Promise.all([loadDeck(), loadConversationPacks()])'), src.indexOf('return () => {'));
    // The read has a rejection handler that marks the sitting unread.
    assert.match(load, /\}, \(\) => \{\s*if \(!cancelled\) setUnread\(true\);\s*\}\);/);
    // The unread card comes before the spinner, with the Drill words and a Done.
    const unread = src.indexOf('if (unread)');
    assert.ok(unread > 0 && unread < src.indexOf('if (queue === null)'), 'the unread card must be drawn before the spinner');
    const card = src.slice(unread, src.indexOf('if (queue === null)'));
    assert.match(card, /DRILL_UNREAD\.title/);
    assert.match(card, /DRILL_UNREAD\.body/);
    assert.match(card, /<EndActions done=\{\{ label: 'Done', onPress: onDone \}\} \/>/);
  });
});
