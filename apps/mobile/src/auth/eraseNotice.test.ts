/**
 * Deleting an account when the device will not let go of its copy — F496.
 *
 * Two halves, and the seam between them is the honest one this repo keeps
 * drawing. The ordering is real: `deleteAccountAndErase` is a pure sequence
 * over injected steps, so a call log can say what ran, in what order, and what
 * came back. Where the sentence is *drawn* is a source read, because there is
 * no renderer in this workspace (docs/TESTING.md) — the read can see which side
 * of the auth branch the screen is returned from, and it cannot see a pixel.
 *
 * The defect this holds shut: the warning used to be returned to the Settings
 * sheet, which the sign-out inside the same function had already unmounted, so
 * the only thing that drew it was gone before it arrived. The learner was
 * returned to the sign-in screen believing everything had been erased while the
 * phone still held their learning history.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { deleteAccountAndErase, type DeleteAccountSteps } from './deleteAccountFlow.ts';
import { ERASE_NOTICE_BODY, ERASE_NOTICE_DISMISS, ERASE_NOTICE_TITLE } from './eraseNotice.ts';
import { guiltIn } from '../copy/guilt.ts';

const AUTH_DIR = import.meta.dirname;
const read = (name: string): string => readFileSync(path.join(AUTH_DIR, name), 'utf8');
const APP = readFileSync(path.resolve(AUTH_DIR, '..', '..', 'App.tsx'), 'utf8');

/** The steps, recording themselves, with every outcome dialled from the outside. */
function steps(
  outcomes: {
    reauthenticate?: boolean;
    deleteAccount?: boolean;
    erase?: 'ok' | 'throws';
  } = {},
): { log: string[]; steps: DeleteAccountSteps } {
  const log: string[] = [];
  return {
    log,
    steps: {
      reauthenticate: async () => {
        log.push('reauthenticate');
        return outcomes.reauthenticate === false
          ? { ok: false, message: 'Enter your password to confirm it is you.' }
          : { ok: true };
      },
      deleteAccount: async () => {
        log.push('deleteAccount');
        return outcomes.deleteAccount === false
          ? { ok: false, message: 'The connection dropped. Nothing was deleted. Try again.' }
          : { ok: true };
      },
      eraseThisDevice: async () => {
        log.push('eraseThisDevice');
        if (outcomes.erase === 'throws') throw new Error('the disk is full');
      },
      signOut: async () => {
        log.push('signOut');
      },
      warnLocalCopyKept: () => {
        log.push('warnLocalCopyKept');
      },
    },
  };
}

/** Where a name is written in App.tsx, asserted present so -1 cannot pass as first. */
function at(needle: string, why: string): number {
  const index = APP.indexOf(needle);
  assert.notEqual(index, -1, `${why}; \`${needle}\` is not in App.tsx at all`);
  return index;
}

describe('the device that kept a copy says so, on the far side of the sign-out — F496', () => {
  test('a local erase that failed is told to the learner after the sign-out, not before it', async () => {
    const { log, steps: failing } = steps({ erase: 'throws' });
    const result = await deleteAccountAndErase(failing);

    // The sequence runs to the end. A failed erase does not cancel the
    // sign-out: the server account is gone, so staying signed in would be a
    // session pointing at nothing.
    assert.deepEqual(
      log,
      ['reauthenticate', 'deleteAccount', 'eraseThisDevice', 'warnLocalCopyKept', 'signOut'],
      'the warning is not raised before the sign-out, so nothing holds it across the unmount',
    );

    // And it is not *also* handed back to the caller. That return value is read
    // by the delete sheet, which the sign-out unmounts, so a message here is a
    // message written to a screen that has already gone. This is the assertion
    // that fails if the old shape comes back.
    assert.equal(result.ok, true, 'the account was deleted, and the result says it was not');
    assert.equal(
      result.message,
      undefined,
      'the erase failure is returned to the delete sheet again, which the sign-out has already taken away',
    );

    // The words the learner meets are the shared ones, and they say what
    // happened and what to do about it.
    assert.match(ERASE_NOTICE_BODY, /deleted/, 'the notice never says the online account is gone');
    assert.match(ERASE_NOTICE_BODY, /Clear the app data/, 'the notice never says what to do about the copy');

    // The far side of the door, in the one component that survives it. Both
    // orderings matter: after the signed-in branch has returned, so a learner
    // still signed in cannot meet it, and before the welcome, so a learner who
    // is signed out cannot walk past it.
    const gate = APP.slice(at('function Gate()', 'Gate moved'), at('export default function App()', 'App moved'));
    const branch = gate.indexOf("if (status === 'signedIn' && user !== null)");
    const notice = gate.indexOf('return <EraseNoticeScreen');
    const flow = gate.indexOf('<AuthFlow');
    assert.notEqual(branch, -1, 'Gate no longer branches on being signed in; this test is reading the wrong thing');
    assert.notEqual(notice, -1, 'Gate never draws the notice, so the sentence still reaches nobody');
    assert.notEqual(flow, -1, 'Gate no longer renders the auth flow; this test is reading the wrong thing');
    assert.ok(notice > branch, 'the notice is drawn on the signed-in side of the door, which is where it was invisible');
    assert.ok(notice < flow, 'the welcome is drawn in front of the notice, so the learner never sees it');

    // The sentence is written once. Two copies is how the tested one and the
    // drawn one drift apart.
    assert.ok(
      !APP.includes(ERASE_NOTICE_BODY),
      'App.tsx carries the sentence inline again, so the words on screen are not the words tested here',
    );
    assert.match(
      read('EraseNoticeScreen.tsx'),
      /import \{[^}]*ERASE_NOTICE_BODY[^}]*\} from '\.\/eraseNotice\.ts';/,
      'the notice screen does not draw the shared sentence',
    );
  });

  test('a delete that erased cleanly signs out in silence', async () => {
    const { log, steps: clean } = steps();
    const result = await deleteAccountAndErase(clean, 'hunter2');

    assert.deepEqual(
      log,
      ['reauthenticate', 'deleteAccount', 'eraseThisDevice', 'signOut'],
      'the happy path changed shape; a clean delete erases this device and signs out, and says nothing',
    );
    assert.ok(!log.includes('warnLocalCopyKept'), 'a device that was erased is warned about anyway');
    assert.equal(result.ok, true);
  });

  test('a refusal before the account is gone leaves the learner signed in with a reason', async () => {
    // Both of these are the delete sheet's own business: the learner is still
    // signed in, the sheet is still mounted, and the message reaches the field
    // or the line that draws it. Nothing is erased and nobody is signed out.
    const refused = steps({ reauthenticate: false });
    const first = await deleteAccountAndErase(refused.steps, 'wrong');
    assert.deepEqual(refused.log, ['reauthenticate'], 'a refused reauthentication went on to delete something');
    assert.equal(first.ok, false);
    assert.match(first.message ?? '', /\S/, 'a refusal with nothing to read is a dead button');

    const undeleted = steps({ deleteAccount: false });
    const second = await deleteAccountAndErase(undeleted.steps);
    assert.deepEqual(
      undeleted.log,
      ['reauthenticate', 'deleteAccount'],
      'a server delete that failed still erased this device or signed the learner out',
    );
    assert.equal(second.ok, false);
  });

  test('the notice is dismissible, and it does not survive the launch it belongs to', () => {
    const gate = APP.slice(at('function Gate()', 'Gate moved'), at('export default function App()', 'App moved'));

    // Held in memory. A warning about a device state that may since have been
    // fixed must not arrive on a later launch as though it had just happened.
    assert.match(
      gate,
      /const \[localCopyKept, setLocalCopyKept\] = useState\(false\)/,
      'the notice flag is no longer a plain piece of launch-lived state',
    );
    for (const persistence of ['AsyncStorage', 'SecureStore', 'localStorage']) {
      assert.ok(
        !gate.includes(persistence),
        `Gate now writes to ${persistence}; a notice that outlives the launch is a stale accusation`,
      );
    }
    assert.ok(
      !read('eraseNotice.ts').includes('AsyncStorage') && !read('EraseNoticeScreen.tsx').includes('AsyncStorage'),
      'the notice writes itself to the disk somewhere other than Gate',
    );

    // And there is one way out of it, wired to the flag it clears.
    assert.match(
      gate,
      /<EraseNoticeScreen onDismiss=\{\(\) => setLocalCopyKept\(false\)\} \/>/,
      'the notice cannot be dismissed, so the welcome is behind a screen with no way past it',
    );
    const screen = read('EraseNoticeScreen.tsx');
    assert.match(screen, /<PillButton label=\{ERASE_NOTICE_DISMISS\} onPress=\{onDismiss\} \/>/, 'the notice has no control that dismisses it');
    assert.ok(!screen.includes('<ScreenHeader'), 'the notice draws a way back to a tree that has been unmounted');
  });

  test('the notice is announced, not only drawn', () => {
    // The same three mechanisms Field and the Settings refusals carry, because
    // three platforms want three and no two of them share one. A warning about
    // a device somebody is about to hand on is the last one that may be pixels
    // only. The line itself is TroubleLine, which settings/sections.test.ts
    // holds to the same trio; this is the half that says the notice uses it.
    const screen = read('EraseNoticeScreen.tsx');
    assert.match(
      screen,
      /import \{ TroubleLine \} from '\.\.\/settings\/TroubleLine\.tsx';/,
      'the notice hand-rolls its own line instead of the one announced line the app already has',
    );
    assert.match(
      screen,
      /<TroubleLine message=\{ERASE_NOTICE_BODY\} strong \/>/,
      'the sentence is not handed to the line that announces it',
    );
    assert.doesNotMatch(
      screen,
      /<Text[^>]*>\s*\{ERASE_NOTICE_BODY\}/,
      'the sentence is a bare Text, which is silent to VoiceOver and TalkBack',
    );

    const line = readFileSync(path.resolve(AUTH_DIR, '..', 'settings', 'TroubleLine.tsx'), 'utf8');
    assert.match(line, /role="alert"/, 'the web is not told the line is an alert');
    assert.match(line, /accessibilityLiveRegion="polite"/, 'Android is not told to read the line when it appears');
    assert.match(
      line,
      /AccessibilityInfo\.announceForAccessibility\(message\)/,
      'iOS, which has neither a live region nor an alert role, is left with a line nothing speaks',
    );

    // The headline is a heading, which is how somebody browsing by rotor lands
    // on this screen rather than scrubbing through it.
    assert.match(screen, /accessibilityRole="header"/, 'the notice has no heading for assistive tech to land on');
  });

  test('every word of the notice keeps the copy rules', () => {
    const lines: [name: string, line: string][] = [
      ['ERASE_NOTICE_TITLE', ERASE_NOTICE_TITLE],
      ['ERASE_NOTICE_BODY', ERASE_NOTICE_BODY],
      ['ERASE_NOTICE_DISMISS', ERASE_NOTICE_DISMISS],
    ];
    for (const [name, line] of lines) {
      assert.ok(line.length > 0, `${name} is empty`);
      assert.ok(!/—/.test(line), `${name} carries an em dash`);
      assert.ok(!/\d/.test(line), `${name} carries a digit`);
      assert.equal(guiltIn(line), undefined, `${name} says a word Luvani promised never to say to a learner`);
      // Nothing here explains the plumbing, and nothing here apologises. The
      // learner did nothing wrong and the disk is not their fault either way.
      assert.doesNotMatch(
        line,
        /\b(async|storage|exception|error|api|disk|sorry|unfortunately)\b/i,
        `${name} explains the plumbing or apologises for it: "${line}"`,
      );
    }
    // The body is the one that has to carry a way forward, and it names it.
    assert.match(ERASE_NOTICE_BODY, /\.$/, 'the body is not a finished sentence');
    assert.match(
      ERASE_NOTICE_BODY,
      /clear the app data/i,
      'the body says what happened and nothing about what to do, which strands the learner with it',
    );
  });
});
