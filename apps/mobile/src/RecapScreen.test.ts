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

import { streakGuiltIn } from './copy/guilt.ts';
import { TIMELINES } from './celebrate/timelines.ts';
import { earnedFinish, firstEarnedFinish, postcardLine, postcardStamp } from './recap/evidence.ts';
import { recapMoment } from './recap/moment.ts';

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
    // 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the Recap reads your lines, then the phrase kept.
    assert.ok(at('{KEEPSAKE_COPY.lines}') < at('<KeptPhraseCard'), 'the learner\'s own lines no longer lead the Recap');
    assert.ok(at('<KeptPhraseCard') < at('KEEPSAKE_COPY.sound}'), 'the sound comes before the phrase kept');
    assert.ok(at('KEEPSAKE_COPY.sound}') < at('{nextTime}'), '"Next time" comes before the sound');
    // The offer is the one shared ask now (Come alive Phase 4); its own pins
    // live in reminders/ReminderAsk.test.ts.
    assert.ok(at('{nextTime}') < at('<ReminderAsk'), 'the reminder is offered before the keepsake is over');
    assert.match(render, /currentPage === 'next' &&/);
    assert.match(render, /footer=\{/);
    assert.ok(at('footer={') < at('expanded: more'), 'Finish stays pinned outside the More content');

    // Each piece is the model's, not the screen's.
    assert.match(code, /lines\.map\(\(line, index\) =>/, 'the learner\'s lines are not drawn from the lines they said');
    assert.match(convo, /lines=\{keepsakeLines\(live\.turns\)\}/, 'the conversation does not hand the recap the lines the learner said');
    assert.match(code, /const nextTime = context === null \? null : nextTimeLine\(context\.progress, goalOf\(profile\)\);/, '"Next time" is not the spine\'s next scene');
    assert.match(code, /const keptPhrase = closureFromRecap\(recap, null\)\.phrases\[0\] \?\? null/, 'the kept phrase can change under a save already started');
    // 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the kept phrase is the Recap's one sun card (the hero ground), not a highlighter.
    const kept = readFileSync(new URL('./recap/KeptPhraseCard.tsx', import.meta.url), 'utf8');
    assert.equal((kept.match(/backgroundColor: t\.heroGround/g) ?? []).length, 1, 'the kept phrase is not the one sun card');
    assert.equal((code.match(/heroGround/g) ?? []).length, 0, 'the recap draws a second sun card of its own');
    // Every block appears only once it has something true to show.
    assert.match(render, /\{lines\.length > 0 && \(/, 'an empty "Your lines" block is drawn');
    assert.match(render, /\{nextTime !== null && /, '"Next time" is drawn with nothing to name');
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
    assert.match(code, /\{sound\?\.source === 'live' \? <>\s*<Text accessibilityRole="header"[^>]*>From this conversation<\/Text>\s*<Text[^>]*>Heard when you said the line you were given\.<\/Text>/, 'a live sound is presented as a saved check');
    assert.match(code, /<Label>\{sound\.source === 'live' \? SOUND_FOCUS_LABEL : KEEPSAKE_COPY\.sound\}<\/Label>/, 'a live sound does not share the lesson end card label');
    assert.match(code, /From a saved sound check<\/Text>\s*\{sound && <Text[^>]*>This check concerns its recorded reference line/, 'the saved check lost its own copy');
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
    assert.match(screen, /saveState === 'saved'[\s\S]*\? 'Saved to Progress on this phone'/);
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
    // 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the B buttons: Continue on the blue pages, Next, then Finish.
    assert.match(screen, /<BButton label="Practise this phrase" accessibilityLabel=\{`Practise \$\{keptPhrase\.fr\}`\}/);
    assert.match(code, /nextPage === null && canPractise\s*\? <BButton[\s\S]*?: <BButton/, 'the two exclusive primary states are not one practice-or-next choice');
    assert.match(screen, /const finishLabel = nextPage === null \? 'Finish' : blue \? 'Continue' : 'Next';/);
    assert.match(screen, /accessibilityLabel=\{nextPage === null \? 'Finish conversation' : finishLabel\}/);
    assert.match(screen, /label="Finish conversation" onPress=\{onDone\}/);
    // "See your journey" leaves the room for the Journey tab; "Practise these lines, free" opens the drill.
    assert.match(screen, /accessibilityLabel="See your journey" onPress=\{onSeeJourney\}/);
    assert.match(convo, /onSeeJourney=\{onJourney === undefined \? undefined : \(\) => leaveTo\(onJourney\)\}/);
    assert.match(screen, /accessibilityLabel="Practise these lines, free" onPress=\{\(\) => onPractice\(\{ fr: keptPhrase\.fr, en: keptPhrase\.en, situation \}\)\}/);
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
    const room = readFileSync(new URL('./live/C2LiveRoom.tsx', import.meta.url), 'utf8');
    const orb = readFileSync(new URL('./onboarding/BoldVoiceOrb.tsx', import.meta.url), 'utf8');
    assert.match(
      room,
      /accessibilityLabel=\{micOpen \? 'Pause microphone' : 'Open microphone'\}/,
      'the shared microphone button must own one name for its real state',
    );
    assert.match(orb, /<View \{\.\.\.decorative\}/, 'the blue orb must not duplicate the microphone control name');
    assert.match(convo, /onMic=\{\(\) => void \(live\.micOpen \? live\.pauseMic\(\) : live\.openMic\(\)\)\}/);
  });
});

/**
 * Come alive, core loop 2.9 (F765, F766): the recap is the conversation's end
 * card, so the fanfare the room held back plays here, the progress strip draws
 * what the settle read back, and every independent finish gets its postcard
 * stamped.
 */
describe('the recap is where the conversation is celebrated — F765', () => {
  const SCENE = 'mission:premier-cafe' as const;
  const at = new Date(2026, 9, 2, 12).getTime();

  test('the stamp plays for every independent finish this session, never for an assisted replay', () => {
    // A first finish on the learner's own: the bigger stamp.
    const firstTime = { id: SCENE, rung: 4 };
    assert.equal(earnedFinish(firstTime), true);
    assert.equal(postcardStamp({ independent: earnedFinish(firstTime), firstEarned: firstEarnedFinish([], firstTime) }), 'first');
    // On their own again, with the can-do earned before: stamped again, the lighter one.
    const again = { id: SCENE, rung: 4 };
    const earnedBefore = [{ id: SCENE, rung: 4 as const, at }];
    assert.equal(firstEarnedFinish(earnedBefore, again), false);
    assert.equal(postcardStamp({ independent: earnedFinish(again), firstEarned: firstEarnedFinish(earnedBefore, again) }), 'again', 'a second independent finish went unstamped');
    // A replay with help, on a can-do earned before: no stamp, whatever the history.
    for (const rung of [1, 2, 3]) {
      const helped = { id: SCENE, rung };
      assert.equal(earnedFinish(helped), false, `a finish on rung ${rung} was taken for one on the learner's own`);
      assert.equal(postcardStamp({ independent: earnedFinish(helped), firstEarned: firstEarnedFinish(earnedBefore, helped) }), null, `an assisted replay on rung ${rung} was stamped`);
    }
    assert.equal(earnedFinish({ id: 'mission:zeppelin', rung: 4 }), false, 'a scene this build does not know was stamped');
    assert.equal(postcardStamp({ independent: false, firstEarned: true }), null, 'a stamp without an independent finish');

    // What the page says under the postcard, true of this session.
    assert.equal(postcardLine('first'), 'Your first independent finish here.');
    assert.equal(postcardLine('again'), 'You did it on your own again.');
    assert.equal(postcardLine(null), 'A can-do you have earned.');
    for (const line of [postcardLine('first'), postcardLine('again'), postcardLine(null)]) {
      assert.doesNotMatch(line, /\d|[—–·]/);
      assert.equal(streakGuiltIn(line), undefined);
    }

    // The two stamps sound and feel as the master table says.
    const sounds = (id: 'postcard-first' | 'postcard-again') => TIMELINES[id].beats.flatMap((beat) => (beat.sound ? [beat.sound] : []));
    const haptics = (id: 'postcard-first' | 'postcard-again') => TIMELINES[id].beats.flatMap((beat) => (beat.haptic ? [beat.haptic] : []));
    assert.deepEqual(sounds('postcard-first'), ['badge']);
    assert.deepEqual(haptics('postcard-first'), ['celebrate']);
    assert.deepEqual(sounds('postcard-again'), ['correct']);
    assert.deepEqual(haptics('postcard-again'), ['arrived']);

    // The screens ask these rules. The conversation decides independence at
    // the flip, from the rung the winning view carried; the recap stamps only
    // what that said, and draws an assisted finish's postcard still.
    assert.match(convo, /setIndependentFinish\(earnedFinish\(step\.record\)\);/, 'the conversation never says whether this finish was on the learner\'s own');
    assert.match(convo, /independentFinish=\{win\.seen && independentFinish\}/, 'a finish from another session reaches the recap');
    assert.match(code, /const stamp = postcardStamp\(\{ independent: independentFinish, firstEarned \}\);/);
    // 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the postcard tile (cafe-table on peach) is what the stamp lands on.
    assert.match(
      render,
      /tile=\{stamp !== null\s*\? <PostcardStamp art=\{postcardIllustration\(mission\.id\)\} kind=\{stamp\} momentKey=\{momentKey\}><PostcardTile \/><\/PostcardStamp>\s*: <PostcardTile \/>\}/,
      'the stamp plays without an independent finish, or an assisted finish lost its postcard',
    );
    assert.match(render, /\{postcardLine\(stamp\)\}/);
    const stamp = read('./celebrate/PostcardStamp.tsx');
    assert.match(stamp, /claimInPlace\(`\$\{scopeGeneration\(\)\}:stamp:\$\{momentKey\}`\)/, 'the stamp replays when its page is turned back to');
    assert.match(stamp, /TIMELINES\[kind === 'first' \? 'postcard-first' : 'postcard-again'\]/);
    assert.match(stamp, /onCue: first \? fireBeat : noop,/, 'the stamp sounds on a replay, or around the effects module');
  });

  test('the recap plays the moment the room held back, and its strip draws only what the settle read back', () => {
    // A conversation that won something plays; a scene on the learner's own adds confetti.
    assert.deepEqual(recapMoment({ won: true, sceneFinished: false, independentFinish: false }), { plays: true, burst: false });
    assert.deepEqual(recapMoment({ won: true, sceneFinished: true, independentFinish: false }), { plays: true, burst: false }, 'a scene finished with help threw the confetti of one finished alone');
    assert.deepEqual(recapMoment({ won: true, sceneFinished: true, independentFinish: true }), { plays: true, burst: true });
    assert.deepEqual(recapMoment({ won: false, sceneFinished: false, independentFinish: false }), { plays: false, burst: false }, 'a recap with nothing in it celebrated');
    const beats = TIMELINES['recap-result'].beats;
    assert.deepEqual(beats.flatMap((beat) => (beat.sound ? [beat.sound] : [])), ['complete']);
    assert.deepEqual(beats.flatMap((beat) => (beat.haptic ? [beat.haptic] : [])), ['celebrate']);

    assert.match(code, /const moment = useRecapMoment\(\{ key: momentKey, plays: scene\.plays \}\);/);
    assert.match(render, /<ResultArt moment=\{moment\} burst=\{scene\.burst\}/, 'the result page has no moment around its drawing');
    assert.match(code, /const strip = progressStripView\(delta\);/, 'the strip is not drawn from the settled delta');
    // 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the strip is the three stat tiles, still on the moment's beat.
    assert.match(render, /\{strip !== null && moment\.reached\('strip'\) \? <StatTiles tiles=\{stats\} \/> : strip === null \? <StatTiles tiles=\{stats\} \/> : null\}/);
    assert.match(code, /afterSessionStats\(\{ activeSec, phrases: sessionCredit\(recap\.stats\)\.showPhrases \? recap\.phrases\.length : 0, xp: strip\?\.xp\?\.value \?\? null \}\)/);
    assert.match(convo, /\}\)\.then\(setConvoDelta\);/, 'the conversation drops what the settle read back');
    assert.match(convo, /delta=\{convoDelta\}/);
    // The lines count up to the number said, once, and are read out once at that number.
    // 2026-10-21 UI-008, artboards B-AfterSession, B-Celebrate and B-Recap: the Recap lists the lines with the tutor's voice for each, and no count-up.
    assert.match(render, /<LineRow key=\{line\} line=\{line\} last=\{index === lines\.length - 1\} onHear=\{\(\) => hear\(line\)\} \/>/);
    assert.doesNotMatch(render, /<CountUp\b/);
    // XP is never worked out on this screen.
    assert.doesNotMatch(code, /conversationXp\(|xpCreditedFor\(|totalXp\(/, 'the recap computes XP itself');
  });

  test('the conversation holds the celebration queue from before it settles until the recap is showing — F766', () => {
    const flat = (source: string) => source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1').replace(/\s+/g, ' ');
    const room = flat(convo);
    const hold = room.indexOf('settleHold.current ??= holdCelebrations();');
    const settle = room.indexOf("settleSitting({ source: 'convo'");
    assert.ok(hold !== -1 && settle !== -1 && hold < settle, 'the conversation settles before the queue is held');
    assert.match(room, /useEffect\(\(\) => \{ if \(!recapShown\) return; settleHold\.current\?\.\(\); settleHold\.current = null; \}, \[recapShown\]\);/, 'the hold is never handed back once the recap shows');
    assert.match(room, /useEffect\(\(\) => \(\) => \{ settleHold\.current\?\.\(\); settleHold\.current = null; \}, \[\]\);/, 'leaving the room keeps the queue held for ever');
    assert.match(room, /onResultShown=\{resultShown\}/);
    // The recap takes its own hold first, then says it is showing.
    const recap = flat(screen);
    const own = recap.indexOf('useEffect(() => holdCelebrations(), []);');
    const shown = recap.indexOf('resultShown.current?.();');
    assert.ok(own !== -1 && shown !== -1 && own < shown, 'the recap lets the conversation\'s hold go before taking its own');
  });
});
