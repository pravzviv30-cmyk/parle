/**
 * The conversation's end card, as a keepsake — notebook Phase 4 (B1), 2026-09-27.
 *
 * It reads, in order: the lines the learner said, one phrase kept (on the
 * screen's one highlighter), one sound, "Next time: <the spine's next scene>",
 * and only then an offer of a daily reminder at the learner's chosen time. The
 * phone's notification dialog is raised only when that offer is accepted. The
 * rest of what the closure chose (the wins, the other phrases, the small fix)
 * is one tap away under a closed More. The decisions are `live/keepsake.ts`'s
 * and are held in its suite; this holds the screen to asking them.
 *
 * Source assertions, because the mobile suite deliberately has no React Native
 * renderer (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
const screen = read('./RecapScreen.tsx');
const convo = read('./ConvoScreen.tsx');
const keepsake = read('./live/recapKeepsake.ts');
const nav = read('./nav/RootNavigator.tsx');

/** The screen without comments, so an order check reads JSX and not prose. */
const code = screen.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' ')).replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
const render = code.slice(code.indexOf('return ('));
function at(marker: string): number {
  const i = render.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the recap at all`);
  return i;
}

describe('the recap is a keepsake', () => {
  test('it reads your lines, one phrase kept, one sound, then "Next time", then the reminder offer', () => {
    assert.ok(at('{KEEPSAKE_COPY.lines}') < at('<Highlight text={keptPhrase.fr}'), 'the kept phrase comes before the learner\'s own lines');
    assert.ok(at('<Highlight text={keptPhrase.fr}') < at('{KEEPSAKE_COPY.sound}'), 'the sound comes before the phrase kept');
    assert.ok(at('{KEEPSAKE_COPY.sound}') < at('{nextTime}'), '"Next time" comes before the sound');
    assert.ok(at('{nextTime}') < at('{offer.title}'), 'the reminder is offered before the keepsake is over');
    assert.match(render, /currentPage === 'next' &&/);
    assert.match(render, /footer=\{/);
    assert.ok(at('footer={') < at('expanded: more'), 'Finish stays pinned outside the More content');

    // Each piece is the model's, not the screen's.
    assert.match(code, /lines\.map\(\(line\) =>/, 'the learner\'s lines are not drawn from the lines they said');
    assert.match(convo, /lines=\{keepsakeLines\(live\.turns\)\}/, 'the conversation does not hand the recap the lines the learner said');
    assert.match(code, /const nextTime = context === null \? null : nextTimeLine\(context\.progress\);/, '"Next time" is not the spine\'s next scene');
    assert.match(code, /const keptPhrase = closureFromRecap\(recap, null\)\.phrases\[0\] \?\? null/, 'the kept phrase can change under a save already started');
    // The kept phrase is the screen's one highlighter mark.
    assert.equal((code.match(/<Highlight\b/g) ?? []).length, 1, 'the recap draws more or less than one highlighter');
    // Every block appears only once it has something true to show.
    assert.match(render, /\{lines\.length > 0 && \(/, 'an empty "Your lines" block is drawn');
    assert.match(render, /\{nextTime !== null && /, '"Next time" is drawn with nothing to name');
  });

  test('the notification permission is asked only when the learner accepts the reminder offer', () => {
    // Offered only after a win, at the chosen time, from facts already read.
    assert.match(code, /const won = lines\.length > 0 \|\| keptPhrase !== null;/, 'the offer is not gated on the first win');
    assert.match(code, /const offer = reminderOffer\(\{ available: REMINDERS_AVAILABLE, won, stored, permission \}\);/);
    // Read on the way in, never asked.
    assert.match(code, /Promise\.all\(\[loadReminder\(\{ strict: true \}\), reminderPermission\(\)\]\)/, 'the recap does not read the permission it offers against');
    for (const effect of code.split('useEffect(').slice(1)) {
      const body = effect.slice(0, effect.indexOf('}, ['));
      assert.ok(!body.includes('askReminderPermission'), 'an effect raises the notification dialog nobody accepted');
    }
    // Asked in exactly one place: the accept handler, through the model.
    assert.equal((code.match(/\baskReminderPermission\b/g) ?? []).length, 2, 'the dialog is reachable from somewhere other than the accept handler');
    const accept = code.slice(code.indexOf('const acceptReminder = '), code.indexOf('};', code.indexOf('const acceptReminder = ')));
    assert.match(accept, /acceptReminderOffer\(offer, \{ ask: askReminderPermission, read: reminderPermission, save: saveReminder, schedule: scheduleReminder \}\)/);
    assert.match(render, /<OutlineButton label=\{offer\.accept\}[^>]*onPress=\{acceptReminder\}/, 'the accept control does not accept');
    assert.match(render, /<GhostButton label=\{offer\.decline\}/, 'there is no quiet way to say no');
    assert.match(render, /reminderAnswerLine\(reminder, offer\)/, 'the answer is not said once the learner has chosen');
  });

  test('everything else the closure chose is one tap away under a closed More', () => {
    assert.match(code, /const \[more, setMore\] = useState\(false\);/, 'More opens by itself');
    assert.equal((code.match(/accessibilityState=\{\{ expanded: more \}\}/g) ?? []).length, 1, 'there is not exactly one More disclosure');
    const more = render.slice(render.indexOf('{more && ('));
    assert.ok(render.includes('{more && ('), 'nothing is behind More');
    for (const part of ['closure.didWell.map(', 'otherPhrases.map(', 'otherFocus']) {
      assert.ok(more.includes(part), `${part} is no longer reachable from More`);
    }
    // The three-phrase ceiling holds across the keepsake and the rest.
    assert.match(code, /phrase\.key !== keptPhrase\?\.key/);
    assert.match(code, /slice\(0, MAX_CLOSURE_PHRASES - 1\)/);
  });

  test('a focus sound is said with a word first, and its symbol is an optional detail', () => {
    assert.match(code, /exampleFirstHeading\(sound\.acoustic, sound\.example\)/, 'the recap leads the sound with notation');
    assert.match(code, /const \[soundDetail, setSoundDetail\] = useState\(false\);/, 'the sound symbol is shown before anyone asks');
    assert.match(code, /soundDetail && <Text[^>]*>\{sound\.acoustic\.heading\}<\/Text>/, 'the original notation is not reachable at all');
    assert.match(code, /SOUND_DETAIL\.show/, 'the toggle spells its own words');
  });

  test('the recap wears the notebook: no feature paper, no tint, no postcard, one frame', () => {
    for (const gone of ['accent.', 'TintPanel', '<Art', 'SCREEN_ART', 'useSafeAreaInsets', 'Animated', '<ScrollView']) {
      assert.ok(!code.includes(gone), `the recap still carries ${gone}`);
    }
    assert.match(render, /<ScrollScreen\b/, 'the recap measures its own frame instead of borrowing the shared one');
  });
});

describe('the conversation closes with something useful', () => {
  test('the exact visible keepsake is durable before the recap calls it saved', () => {
    assert.match(screen, /onSave\(\{ fr: keptPhrase\.fr, en: keptPhrase\.en, situation \}\)/);
    assert.match(screen, /saveState === 'saved'[\s\S]*\? 'Saved to Progress'/);
    assert.match(screen, /saveState === 'failed'[\s\S]*\? 'Not saved yet'/);
    assert.match(keepsake, /const acknowledged = await addPhrases\(/);
    assert.match(keepsake, /return acknowledged === 'durable'/);
    assert.match(convo, /onSave=\{saveRecapKeepsake\}/);
    assert.doesNotMatch(
      convo,
      /addPhrases\(/,
      'the exact keepsake must not make the conversation outbox optional',
    );
  });

  test('practice is the recommended next action and finishing stays available', () => {
    assert.match(screen, /<GhostButton\s+label="Practise this phrase"/);
    assert.match(code, /nextPage === null && canPractise\s*\? <PillButton[\s\S]*?: <PillButton/, 'the two exclusive primary states are not one practice-or-next choice');
    assert.match(screen, /nextPage === null \? 'Finish conversation' : 'Next'/);
    assert.match(screen, /accessibilityLabel="Finish conversation" onPress=\{onDone\}/);
    assert.match(screen, /currentPage === 'lines' &&/);
    assert.match(screen, /nextPage === null \? onDone\(\) : setPage/);
    assert.match(convo, /leaveTo\(\(\) => onPractice\(phrase\)\)/);
    assert.match(
      convo,
      /onPractice=\{onPractice === undefined \? undefined : practiseAfterRecap\}/,
      'the recap bypasses the room-closing path',
    );
    assert.match(
      nav,
      /onPractice=\{\(phrase\) => nav\.replace\('Drill', \{ ownWords: phrase \}\)\}/,
      'the drill is pushed over a stale conversation instead of replacing it',
    );
  });

  test('the scene mic button owns one accessible name', () => {
    assert.match(
      convo,
      /accessibilityLabel=\{OPEN_MIC_LABEL\}[\s\S]*?<VoiceOrb state=\{orbState\} size=\{SCENE_ORB\} announce=\{false\} \/>/,
      'the VoiceOrb announces itself inside a Pressable that already owns the Tap to talk name',
    );
  });
});
