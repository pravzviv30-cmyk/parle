/**
 * A reloaded live room (F923). The web address survives a reload but the room
 * does not, and the old screen started a new session on mount, in whatever
 * mode the stringified params happened to read as. Now a conversation reached
 * by a cold load of its own address lands on a small intro and waits.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { RELOAD_INTRO, reloadedIntoConvo } from './reloadGate.ts';
import { convoStartFromParams } from './convoStart.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

describe('a reloaded conversation waits to be asked — F923', () => {
  test('reloading a live room lands on the scene intro and keeps the learner\'s mode', () => {
    assert.equal(reloadedIntoConvo({ platform: 'web', coldPath: '/conversation', consumed: false }), true);
    assert.equal(reloadedIntoConvo({ platform: 'web', coldPath: '/app/conversation/', consumed: false }), true);
    // Once answered, an in-app start is never held; a cold load elsewhere is not a reload of a room; native has no address.
    assert.equal(reloadedIntoConvo({ platform: 'web', coldPath: '/conversation', consumed: true }), false);
    assert.equal(reloadedIntoConvo({ platform: 'web', coldPath: '/', consumed: false }), false);
    assert.equal(reloadedIntoConvo({ platform: 'web', coldPath: '/conversations', consumed: false }), false);
    assert.equal(reloadedIntoConvo({ platform: 'ios', coldPath: null, consumed: false }), false);
    assert.equal(reloadedIntoConvo({ platform: 'web', coldPath: null, consumed: false }), false);

    assert.deepEqual(RELOAD_INTRO, { title: 'Your last conversation ended.', start: 'Start again', back: 'Back to Tutor' });
    assert.doesNotMatch(Object.values(RELOAD_INTRO).join(' '), /—/);

    // The mode the address carried, as strings, survives into the new start.
    assert.equal(convoStartFromParams({ textMode: 'false' }, { preferTyping: true }).openedTyped, false);
    assert.equal(convoStartFromParams({ textMode: 'true' }, null).openedTyped, true);

    // The route holds the screen (and so the session start) behind the intro.
    const nav = read('../nav/RootNavigator.tsx');
    assert.match(nav, /const \[reloaded, setReloaded\] = useState\(\(\) => isReload\(Platform\.OS\)\);/);
    assert.match(nav, /useEffect\(\(\) => \{ consumeReload\(\); \}, \[\]\);/);
    assert.match(nav, /if \(reloaded\) return <ReloadIntro onStart=\{\(\) => setReloaded\(false\)\} onBack=\{leave\} \/>;/);
    assert.ok(nav.indexOf('if (reloaded) return <ReloadIntro') < nav.indexOf('<LazyConvoScreen'), 'the session can start before the intro is answered');
  });
});
