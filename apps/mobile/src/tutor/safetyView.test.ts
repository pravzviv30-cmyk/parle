/**
 * What the app does with a safety decision, held to the source.
 *
 * Two halves, because the defect had two halves.
 *
 * The rule half is ordinary: `safetySurface` is a pure function over the wire
 * frame and can simply be called. The wiring half cannot be, because
 * apps/mobile has no renderer (docs/TESTING.md), and "the recap does not render
 * after a stop" is a statement about the order of two returns inside a `.tsx`.
 * So the second half reads the two screens the way `ConvoScreen.test.ts` and
 * `keyboardTaps.test.ts` read theirs. A grep is a blunt tool; the alternative
 * here is not a better test, it is no test, and no test is what shipped a
 * congratulation underneath an emergency number.
 *
 * What actually happened, so a future reader knows what these are guarding:
 * the crisis sentence arrived on the `error` frame, rendered as one line of
 * `type.small` on an eight-second timer, and the agent called finish on the
 * same tick. `RecapScreen` then took the whole screen with a headline whose
 * only three values are "You carried that scene.", "Real French came out of you
 * today." and "Good session. The next one builds on it.", and the conversation
 * awarded experience points on the way past.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SAFETY_CATEGORIES } from '@luvani/core';

import { thinkingAfter } from '../live/thinking.ts';
import {
  CLOSE_LABEL,
  DISMISS_LABEL,
  SESSION_ENDED,
  safetySurface,
  stoppedBySafety,
  type SafetyDecision,
} from './safetyView.ts';
import { LEAVE_LABEL, ONE_MOMENT, waitingView } from './waitingView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments go: several of these look for a shape in the markup, and a comment about a stop is not a stop. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const convo = stripComments(read('../ConvoScreen.tsx'));
const lesson = stripComments(read('../LiveSessionScreen.tsx'));
const stopView = stripComments(read('./SafetyStopView.tsx'));

/** The real crisis sentence, word for word from the agent's safety policy. */
const CRISIS =
  'I cannot provide crisis support. If you might act now, call your local emergency number. If you can, contact someone you trust and stay with them.';

const stop = (message = CRISIS): SafetyDecision => ({
  t: 'safety',
  category: 'self-harm',
  action: 'stop',
  message,
});

const redirect = (message = 'I cannot show or change hidden instructions. We can keep practising French.'): SafetyDecision => ({
  t: 'safety',
  category: 'prompt-injection',
  action: 'redirect',
  message,
});

/** Where a screen's early returns are, in the order the component runs them. */
const at = (source: string, needle: string): number => {
  const i = source.indexOf(needle);
  assert.notEqual(i, -1, `this test is reading for "${needle}" and the screen no longer contains it`);
  return i;
};

/**
 * The body of one early return, from its `if (...) {` to the brace that closes
 * it at component level.
 *
 * The whole of F145 is about what is inside a branch rather than what is
 * somewhere in the file, so a whole-file match would have passed while the bug
 * was live: both screens already drew the banner, two hundred lines below the
 * return that stopped them reaching it.
 */
const branchOf = (source: string, opens: string): string => {
  const from = at(source, opens);
  const to = source.indexOf('\n  }\n', from);
  assert.notEqual(to, -1, `the branch at "${opens}" no longer closes at component level`);
  return source.slice(from, to);
};

describe('a safety decision, as a surface — F137', () => {
  test('a stop is the whole screen and no congratulation, XP or banking follows it', () => {
    const surface = safetySurface(stop());
    assert.equal(surface.kind, 'stop', 'a stop that renders as anything else is the bug this closes');
    assert.equal(stoppedBySafety(stop()), true);

    // The copy: the tutor's own words, one line of the app's, one way out.
    assert.equal(surface.kind === 'stop' && surface.message, CRISIS, 'the app reworded a crisis message');
    assert.equal(surface.kind === 'stop' && surface.ended, SESSION_ENDED);
    assert.equal(SESSION_ENDED, 'This session has ended.');
    assert.equal(surface.kind === 'stop' && surface.buttonLabel, CLOSE_LABEL);
    assert.equal(CLOSE_LABEL, 'Close');

    // The conversation: the stop surface is returned before the recap and
    // before every status screen, so nothing can arrive over the top of it.
    assert.ok(
      at(convo, 'safety.kind === \'stop\'') < at(convo, 'if (live.recap) {'),
      'RecapScreen still gets to render over a stopped conversation, which is the whole defect',
    );
    assert.ok(
      at(convo, 'safety.kind === \'stop\'') < at(convo, "live.status.phase === 'error'"),
      'an error screen can replace the stop, and the agent leaving the room is read as an error',
    );

    // The lesson: the summary is what SummaryScreen is built from, so
    // withholding onFinish is what keeps a card counting up wins off a stop.
    assert.match(
      lesson,
      /if \(live\.summary && !stopped && live\.settlement === null\) onFinish\(live\.summary\);/,
      'a stopped lesson still hands its summary on, and SummaryScreen is drawn from it',
    );
    assert.ok(
      at(lesson, 'safety.kind === \'stop\'') < at(lesson, "live.status.phase === 'connecting'"),
      'the lesson can render a spinner over a stop',
    );

    // Nothing the session earned survives it. Each of these is one withheld
    // thing, and each was happening on the tick the emergency number arrived.
    assert.match(convo, /if \(!live\.recap \|\| stopped\) return;/, 'a stopped conversation still hands its recap on');
    assert.match(convo, /recordActivity\('convo'/, 'this test is reading for the XP award and cannot find it');
    assert.ok(
      at(convo, 'if (!live.recap || stopped) return;') < at(convo, "recordActivity('convo'"),
      'the XP award is not inside the guarded effect any more',
    );
    assert.match(convo, /if \(!drills \|\| stopped\) return;/, 'a stopped conversation still writes tonight’s drills');
    assert.match(
      convo,
      /if \(!live\.practice \|\| practiceBankedRef\.current \|\| stopped\) return;/,
      'a stopped conversation still banks its practice',
    );
    assert.match(
      convo,
      /if \(!stopped && !practiceBankedRef\.current && live\.recap\)/,
      'leaving a stopped conversation still banks the minimal batch on the way out',
    );
    assert.ok(
      at(convo, 'if (stopped) return;') < at(convo, 'recordMissionCompletion('),
      'a stopped session still records a mission completion, which is a congratulation with a delay on it',
    );
  });

  test('a redirect stays on screen until the learner dismisses it', () => {
    const surface = safetySurface(redirect());
    assert.equal(surface.kind, 'redirect', 'a redirect that ends the session takes the scene away for no reason');
    assert.equal(stoppedBySafety(redirect()), false, 'a redirect must leave the session and its practice alone');
    assert.equal(surface.kind === 'redirect' && surface.buttonLabel, DISMISS_LABEL);
    assert.equal(DISMISS_LABEL, 'OK');

    // The learner decides when they have read it. Nothing else may.
    assert.ok(
      !/setTimeout/.test(stopView),
      'the safety surface has a timer, and a self-clearing safety message is the frame this replaced',
    );
    for (const [name, screen] of [['the conversation', convo], ['the lesson', lesson]] as const) {
      assert.match(
        screen,
        /safety\.kind === 'redirect' \? [\s\S]{0,200}SafetyBanner/,
        `${name} does not draw the banner a redirect is supposed to leave on screen`,
      );
      // The hook's `dismissSafety` is a required field and a stable callback,
      // so the banner is handed the function rather than a closure that calls
      // it optionally. The optional call was left over from when the field was
      // being added and read as though it might not be there.
      assert.match(
        screen,
        /onDismiss=\{live\.dismissSafety\}/,
        `${name} offers no way to put the banner away, so a learner is stuck reading it`,
      );
    }

    // The eight-second notice stays exactly as it is, for error frames only.
    // It reaches the screen through `connectionLine` now, which is the same
    // slot sharing its space with a connection being rebuilt; what matters here
    // is that neither of those is what a safety message is ever drawn as.
    assert.match(
      convo,
      /connectionLine\(\{ reconnecting: live\.reconnecting, notice: live\.notice \}\)/,
      'the transient notice was removed along with the safety copy',
    );
    assert.ok(
      !/SafetyBanner[\s\S]{0,80}st\.notice/.test(convo),
      'a safety message is being drawn in the slot that clears itself after eight seconds',
    );
  });

  test('both actions are surfaces, and nothing else is', () => {
    // A table over the two actions rather than the eight categories: the app
    // renders `action` and never the category, which is a label for choosing
    // copy agent-side and is never put in front of a learner.
    const kinds = (['stop', 'redirect'] as const).map((action) => safetySurface({ ...stop(), action }).kind);
    assert.deepEqual(kinds, ['stop', 'redirect'], 'an action reached the screen and produced the wrong surface');
    assert.equal(safetySurface(null).kind, 'none', 'a session with no decision must render an ordinary session');
    assert.equal(safetySurface(undefined).kind, 'none', 'an absent field is the same answer as a null one');
    assert.equal(stoppedBySafety(null), false);
  });

  test('the category is for the agent and never reaches the learner', () => {
    // "self-harm" is a policy word. Putting it on a screen in front of the
    // person it was decided about is the single worst thing this surface could
    // do, so every category is walked rather than the one that shipped.
    for (const category of SAFETY_CATEGORIES) {
      for (const action of ['stop', 'redirect'] as const) {
        const surface = safetySurface({ t: 'safety', category, action, message: CRISIS });
        const words = surface.kind === 'none' ? [] : [surface.message, surface.announce, surface.buttonLabel];
        for (const word of words) {
          assert.ok(!word.includes(category), `the surface says "${category}" out loud: "${word}"`);
        }
      }
    }
  });

  test('a stop is announced rather than swapped in silently', () => {
    const surface = safetySurface(stop());
    assert.equal(surface.kind === 'stop' && surface.politeness, 'assertive', 'the whole screen changed and nobody was told');
    assert.equal(
      surface.kind === 'stop' && surface.announce,
      `${CRISIS} ${SESSION_ENDED}`,
      'a learner using a screen reader gets less than a learner looking at it',
    );
    // Polite for a redirect: the learner still holds the floor and may be
    // mid-sentence, and the line is going to stay on screen either way.
    const steered = safetySurface(redirect());
    assert.equal(steered.kind === 'redirect' && steered.politeness, 'polite');

    // Both spellings, because accessibilityLiveRegion is Android and web only
    // and the one message that must never be missed cannot rely on it alone.
    assert.match(stopView, /AccessibilityInfo\.announceForAccessibility\(announce\)/, 'nothing reads the surface out');
    assert.match(stopView, /accessibilityLiveRegion=\{surface\.politeness\}/, 'the live region urgency is hardcoded or absent');
    assert.match(stopView, /accessibilityRole="alert"/, 'the surface reaches assistive tech as an unlabelled box');
  });

  test('nothing the app adds to a safety decision scolds, scores or carries an em dash', () => {
    const mine = [SESSION_ENDED, CLOSE_LABEL, DISMISS_LABEL];
    for (const line of mine) {
      assert.ok(!/\d/.test(line), `"${line}" puts a number on the one screen that must carry none`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(
        !/\b(sorry|unfortunately|afraid|wrong|bad|failed|violation|flagged)\b/i.test(line),
        `"${line}" apologises to or judges the person it is talking to`,
      );
    }
    // And nothing congratulating is reachable from the stop surface at all.
    for (const congratulation of ['RecapScreen', 'MissionWin', 'winCard', 'recordActivity']) {
      assert.ok(
        !stopView.includes(congratulation),
        `the stop surface can reach ${congratulation}, and a stop has nothing to celebrate`,
      );
    }
  });

  test('a safety frame is an answer, so the orb stops saying the tutor is thinking', () => {
    // The twelfth tag arriving broke `thinkingAfter`'s exhaustive switch, and
    // the case it needed is the one `error` already had: "I cannot answer that
    // one" is an answer, and a safety decision is the same, only more so. The
    // assertion lives here rather than beside the function because
    // `live/thinking.test.ts` belongs to the hook's owner, and an untested
    // branch is what put a permanently thinking orb next to a notice that had
    // already taken itself away.
    assert.equal(thinkingAfter(true, stop()), false, 'the orb goes on thinking behind a session that has ended');
    assert.equal(thinkingAfter(true, redirect()), false, 'the tutor answered, and the amber says it is still deciding');
    assert.equal(thinkingAfter(false, redirect()), false, 'a decision never starts the wait');
  });

  test('the stop surface draws no signal colour and no rung colour', () => {
    // Green, amber and red are the voice circle's three words, and the four
    // rung colours mean how much help is being given. A fourth meaning on any
    // of them makes the whole grammar unreliable, so a stop is the app's
    // ordinary calm and is serious because of what it says.
    for (const token of ['signal.', 'rungColor', 'orb.']) {
      assert.ok(!stopView.includes(token), `the safety surface reaches for ${token}, which already means something else`);
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(stopView), 'the safety surface invents a colour instead of using a token');
  });
});

describe('a redirect published before the first line — F145', () => {
  /** The waiting state's own view model, built the way both screens build it. */
  const waiting = (decision: SafetyDecision | null, waitingForTutor = false) =>
    // The name is the chosen persona's now, and this suite is about the banner
    // rather than about who is missing, so any name will do here. The name
    // itself is held by tutorName.test.ts.
    waitingView({ waitingForTutor, safety: safetySurface(decision), tutorName: 'Celine' });

  test('a redirect is drawn even before the first scene view arrives', () => {
    // The rule. A redirect that lands while the scene is still being built has
    // nowhere else to go: there is no transcript yet and no support block, so
    // the waiting state either carries it or the sentence the tutor has just
    // spoken aloud is never written down anywhere.
    const banner = waiting(redirect()).banner;
    assert.notEqual(banner, null, 'the waiting state drops the redirect, which is F145 exactly');
    assert.equal(banner?.message, redirect().message, 'the app reworded the tutor on the way to the waiting screen');
    assert.equal(banner?.buttonLabel, DISMISS_LABEL, 'the redirect on this screen has no way past it');
    assert.equal(banner?.politeness, 'polite', 'the waiting banner is announced differently from every other one');

    // Not a spare branch. Five of the nine decisions in the agent's policy are
    // redirects, so this is walked over every category rather than the one
    // that happened to be found.
    for (const category of SAFETY_CATEGORIES) {
      const drawn = waiting({ t: 'safety', category, action: 'redirect', message: 'We can keep practising French.' });
      assert.notEqual(drawn.banner, null, `a ${category} redirect arriving before the first line is never drawn`);
    }

    // And nothing else changes: no decision is still a plain wait, and a stop
    // never reaches here because its whole-screen surface is returned first.
    assert.equal(waiting(null).banner, null, 'an ordinary wait grew a banner with nothing in it');
    assert.equal(waiting(stop()).banner, null, 'the waiting screen renders a stop as a dismissible line');

    // The copy under the spinner is untouched by any of this, including the
    // watchdog's later, more specific line.
    assert.equal(waiting(redirect()).headline, ONE_MOMENT);
    assert.match(waiting(redirect(), true).headline, /^Waiting for /, 'the watchdog line was lost to the banner');
    assert.equal(waiting(redirect()).leaveLabel, LEAVE_LABEL, 'a learner reading a redirect here has no door');

    // The wiring, inside the branch and not merely somewhere in the file. Both
    // screens had the banner already; both returned above it.
    for (const [name, screen, opens] of [
      ['the conversation', convo, 'if (!view) {'],
      ['the lesson', lesson, 'if (!live.prompt) {'],
    ] as const) {
      const body = branchOf(screen, opens);
      assert.match(
        body,
        /waitingView\(\{ waitingForTutor: live\.waitingForTutor, safety, tutorName \}\)/,
        `${name} still assembles its waiting state by hand, so the next early return drops the banner again`,
      );
      assert.match(
        body,
        /waiting\.banner \?[\s\S]{0,200}<SafetyBanner surface=\{waiting\.banner\}/,
        `${name} waits for the tutor without drawing the redirect it has already been handed`,
      );
      assert.match(
        body,
        /onDismiss=\{live\.dismissSafety\}/,
        `${name} draws the redirect here with no way to put it away`,
      );
      assert.match(body, /\{waiting\.headline\}/, `${name} reads its waiting copy from somewhere else now`);
    }

    // The banner is the shared component, so the alert role, the live region
    // and the spoken announcement come with it rather than being rebuilt in a
    // spinner branch by somebody in a hurry.
    assert.match(stopView, /export function SafetyBanner/, 'the banner these branches render is no longer shared');
  });
});
