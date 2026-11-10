/**
 * The conversation's end card, as a keepsake — notebook Phase 4 (B1), 2026-09-27.
 *
 * It reads, in order: the lines the learner said, one phrase kept (on the
 * screen's one highlighter), one sound, "Next time: <the spine's next scene>",
 * and only then an offer of a daily reminder at the learner's chosen time. The
 * phone's notification dialog is raised only when that offer is accepted.
 * Since UI-020 it is one scroll in the end scene's frame with a pinned footer;
 * the wins and the other phrases left the screen (docs/changes/recap.md,
 * "Where More went"). The decisions are `live/keepsake.ts`'s and
 * `recap/afterSessionView.ts`'s and are held in their suites; this holds the
 * screen to asking them.
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
const sheet = read('./recap/FocusSheet.tsx');
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
    // UI-020: the one focus row (a sound, or one thing to tune) after the kept phrase and the fixes.
    assert.ok(at('<KeptPhraseCard') < at('<FixCard') && at('<FixCard') < at('{focusRow.label}'), 'the focus row comes before the phrase kept or the fixes');
    assert.ok(at('{focusRow.label}') < at('{nextTime}'), '"Next time" comes before the focus row');
    // The offer is the one shared ask now (Come alive Phase 4); its own pins
    // live in reminders/ReminderAsk.test.ts.
    assert.ok(at('{nextTime}') < at('<ReminderAsk'), 'the reminder is offered before the keepsake is over');
    // One scroll with a pinned footer: no pages left to turn.
    assert.match(render, /footer=\{/);
    assert.doesNotMatch(code, /currentPage|setPage|recapPages/, 'the recap is paged again');

    // Each piece is the model's, not the screen's.
    assert.match(code, /lines\.map\(\(line, index\) =>/, 'the learner\'s lines are not drawn from the lines they said');
    assert.match(convo, /lines=\{keepsakeLines\(live\.turns\)\}/, 'the conversation does not hand the recap the lines the learner said');
    assert.match(code, /const nextTime = context === null \? null : nextTimeLine\(context\.progress, goalOf\(profile\), startAtOf\(profile\)\);/, '"Next time" is not the spine\'s next scene');
    assert.match(code, /const keptPhrase = closureFromRecap\(recap, null\)\.phrases\[0\] \?\? null/, 'the kept phrase can change under a save already started');
    // UI-020: the kept phrase is one lip card with the shared highlighter, the screen's only chartreuse.
    const kept = readFileSync(new URL('./recap/KeptPhraseCard.tsx', import.meta.url), 'utf8');
    assert.equal((kept.match(/<Highlight text=\{fr\} \/>/g) ?? []).length, 1, 'the kept phrase is not on the one highlighter');
    assert.match(kept, /<LipTile\b/, 'the kept phrase is not a lip card');
    assert.doesNotMatch(kept, /heroGround/, 'the kept phrase is a sun card again');
    assert.equal((code.match(/heroGround|<Highlight\b/g) ?? []).length, 0, 'the recap draws a second hero card or highlighter of its own');
    assert.equal((render.match(/<KeptPhraseCard\b/g) ?? []).length, 1, 'the kept phrase shows twice');
    // Every block appears only once it has something true to show.
    assert.match(render, /\{lines\.length > 0 && \(/, 'an empty "Your lines" block is drawn');
    assert.match(render, /\{nextTime !== null && \(celebrate === null \|\| celebrate\.next === null\) && /, '"Next time" is drawn with nothing to name, or beside the earned Next pill');
    // With no reply nothing was measured, so the goals hide like the tiles and lines (UI-020, brief item 4).
    assert.match(render, /\{credit\.settles && goals\.length > 0 \? <View style=\{s\.goalCard\}>/, 'goals are ticked on a recap with no reply');
  });

  test("the closure's one focus is one row that opens one sheet; the wins and other phrases left (UI-020, Q4)", () => {
    assert.doesNotMatch(code, /\bsetMore\b|expanded: more|closure\.didWell\.map\(|otherPhrases\.map\(/, 'the More disclosure or its lists are back');
    assert.match(code, /const focusRow = recapFocusRow\(closure\.focus\);/, 'the row does not ask the one focus rule');
    assert.match(render, /\{focusRow !== null && closure\.focus !== null && \(/, 'a row is drawn with nothing to open');
    assert.match(code, /const \[focusing, setFocusing\] = useState<ClosureFocus \| null>\(null\);/, 'the sheet does not hold the focus it was opened on');
    assert.match(render, /onPress=\{\(\) => setFocusing\(closure\.focus\)\}/, 'the row does not hand its focus to the sheet');
    assert.match(render, /\{focusing !== null && <FocusSheet focus=\{focusing\} onClose=\{\(\) => setFocusing\(null\)\} \/>\}/, 'the sheet stays mounted when closed, or reads the focus live');
    assert.doesNotMatch(render, /focus=\{closure\.focus\}/, 'the open sheet can switch under the learner');
    assert.match(sheet, /if \(focus\.kind !== 'sound'\) \{[\s\S]*?title="One thing to tune"/, 'one thing to tune lost its sheet');
  });

  test('a focus sound is said with a word first, and its symbol is an optional detail', () => {
    // UI-020: the sound page moved verbatim into the focus sheet.
    assert.match(sheet, /exampleFirstHeading\(sound\.acoustic, sound\.example\)/, 'the recap leads the sound with notation');
    assert.match(sheet, /const \[soundDetail, setSoundDetail\] = useState\(false\);/, 'the sound symbol is shown before anyone asks');
    assert.match(sheet, /title=\{sound\.source === 'live' \? 'From this conversation' : 'From a saved sound check'\}/, 'a live sound is presented as a saved check');
    assert.match(sheet, /\{sound\.source === 'live' \? \(\s*<Text[^>]*>Heard when you said the line you were given\.<\/Text>\s*\) : \(\s*<Text[^>]*>This check concerns its recorded reference line/, 'the saved check lost its own copy');
    assert.match(sheet, /<Label>\{sound\.source === 'live' \? SOUND_FOCUS_LABEL : KEEPSAKE_COPY\.sound\}<\/Label>/, 'a live sound does not share the lesson end card label');
    assert.match(sheet, /soundDetail && <Text[^>]*>\{sound\.acoustic\.heading\}<\/Text>/, 'the original notation is not reachable at all');
    assert.match(sheet, /SOUND_DETAIL\.show/, 'the toggle spells its own words');
    assert.match(sheet, /sound\.example !== null && <PrivatePractice key=\{sound\.example\} french=\{sound\.example\} \/>/, 'private practice left the sound');
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
    // UI-020: one pinned footer, its states decided by recapFooter (afterSessionView.test.ts).
    assert.match(code, /const foot = recapFooter\(\{ kept: keptPhrase !== null, practice: onPractice !== undefined, saved: saveState === 'saved', earned: celebrate !== null, journey: onSeeJourney !== undefined \}\);/);
    assert.match(render, /foot\.primary === 'practise'\s*\? <>\s*<PillButton label="Practise this phrase" onPress=\{practise\} disabled=\{foot\.practiseDisabled\} disabledReason=\{foot\.practiseDisabled \? saveLine : undefined\} lip \/>/, 'practise is not the lip primary, held until the save is durable, with the save line as its reason');
    assert.match(render, /: <>\s*<PillButton label="Done" onPress=\{onDone\} lip \/>/, 'Done is not the lip primary when there is nothing to practise');
    assert.equal((render.match(/label="Done" onPress=\{onDone\}/g) ?? []).length, 2, 'Done is missing from a footer state');
    assert.doesNotMatch(screen, /Finish conversation|Practise these lines, free|CloseDisc/, 'a second way out, or a name that differs from the label, is back');
    // "See your journey" leaves the room for the Journey tab, only on an earned scene.
    assert.match(render, /foot\.journey === 'beside' && <OutlineButton label="See your journey" onPress=\{journey\} \/>/);
    assert.match(render, /foot\.journey === 'under' && <View style=\{s\.link\}><OutlineButton label="See your journey" onPress=\{journey\} \/><\/View>/);
    assert.match(convo, /onSeeJourney=\{onJourney === undefined \? undefined : \(\) => leaveTo\(onJourney\)\}/);
    assert.match(code, /const practise = \(\) => \{ if \(keptPhrase !== null && onPractice !== undefined && saveState === 'saved'\) onPractice\(\{ fr: keptPhrase\.fr, en: keptPhrase\.en, situation \}\); \};/);
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

  // Re-homed from recap/pages.test.ts when the pager went (UI-020).
  test('saving is independent of the layout and retries the exact kept phrase', () => {
    const save = screen.slice(screen.indexOf('useEffect(() => {\n    if (keptPhrase'), screen.indexOf('const saveLine'));
    assert.ok(save.length > 0);
    assert.doesNotMatch(save, /page|focusing|fixing/, 'the save waits on what is open');
    assert.match(screen, /const retrySave = \(\) => \{\s*if \(keptPhrase === null \|\| saveState === 'saving' \|\| ownerScope !== scopeGeneration\(\)\) return;/);
    assert.match(render, /saveState === 'failed' && <OutlineButton label="Try saving again" onPress=\{retrySave\} \/>/);
    // Only owner-scoped text offers saving: SaveTextChoice decides it for itself.
    assert.match(render, /\{conversationText && <SaveTextChoice \{\.\.\.conversationText\} \/>\}/);
    assert.match(read('./conversationPacks/SaveTextChoice.tsx'), /if \(user\?\.id !== ownerId \|\| adapter\.kind !== 'supabase' \|\| scope !== scopeGeneration\(\)\) return null;/);
  });

  test('unavailable conversation text is a notice, never a blank save offer', () => {
    assert.match(read('./conversationPacks/SaveTextChoice.tsx'), /if \(!conversation\?\.lines\.length\) return <Text style=\{\[type\.small, \{ color: t\.muted \}\]\}>The complete conversation text is not available to save\. Your curated practice stays available\.<\/Text>;/);
  });

  test('the recap draws no day or week line, so they cannot contradict each other (F937, UI-020)', () => {
    assert.doesNotMatch(screen, /StreakRow|streakLine\(|weekBars\(|loadActiveDays|recapWeekFrom/);
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
    // UI-020: the postcard tile sits in the band on an earned scene, after the band's burst; the stamp throws no confetti of its own.
    assert.match(
      render,
      /postcard=\{celebrate !== null && mission && \(moment\.reached\('strip'\) \|\| moment\.final\) \? \(stamp !== null\s*\? <PostcardStamp art=\{postcardIllustration\(mission\.id\)\} kind=\{stamp\} momentKey=\{momentKey\} confetti=\{false\} sounds=\{false\}><PostcardTile \/><\/PostcardStamp>\s*: <PostcardTile \/>\) : null\}/,
      'the stamp plays without an independent finish, or an assisted finish lost its postcard',
    );
    assert.match(render, /\{postcardLine\(stamp\)\}/);
    assert.equal((render.match(/<Confetti\b/g) ?? []).length, 1, 'the recap throws more than one confetti');
    const stamp = read('./celebrate/PostcardStamp.tsx');
    assert.match(stamp, /claimInPlace\(`\$\{scopeGeneration\(\)\}:stamp:\$\{momentKey\}`\)/, 'the stamp replays when its page is turned back to');
    assert.match(stamp, /TIMELINES\[kind === 'first' \? 'postcard-first' : 'postcard-again'\]/);
    assert.match(stamp, /onCue: first && sounds \? fireBeat : noop,/, 'the stamp sounds on a replay, or around the effects module');
    assert.match(stamp, /onStill: first && sounds \? \(\) => fireStill\(timeline\) : noop,/, 'a silent stamp still plays its still cue');
    assert.match(stamp, /sounds = true,/, 'the stamp is silent by default');
    // UI-020: on the recap the moment's chime is the one cue; the stamp is silent there.
    assert.match(render, /<PostcardStamp [^>]*sounds=\{false\}/, 'the recap stacks the stamp sound on the chime');
    // The stamp's own confetti is on by default, behind one gate, and thrown once.
    assert.match(stamp, /confetti = true,/, 'the stamp lost its own confetti by default');
    assert.match(stamp, /\{confetti && box\.width > 0 \? \(/, 'the stamp throws confetti whatever the page asked');
    assert.equal((stamp.match(/<Confetti\b/g) ?? []).length, 1, 'the stamp throws more than one confetti');
    // With no reply nothing is measured: no tiles, and the eyebrow is the scene alone.
    assert.match(code, /const measured = measuredSec\(credit\.settles, activeSec\);/);
    assert.match(code, /afterSessionStats\(\{ activeSec: measured,/, 'the tiles count a no-reply sitting');
    assert.match(render, /\{recapEyebrow\(situation, measured\)\}/, 'the eyebrow counts a no-reply sitting');
    assert.doesNotMatch(screen, /afterSessionStats\(\{ activeSec,|recapEyebrow\(situation, activeSec\)/);
    // The title rule, as the screen uses it.
    assert.match(code, /const shown = recapTitle\(credit\.settles\);/);
    assert.match(render, /shown\.title === 'headline' \? recap\.headline : credit\.line/);
    assert.match(render, /shown\.lineUnder \?/);
    assert.match(render, /<SceneBand mood=\{credit\.settles \? 'cheer' : 'idle'\} cloud=\{credit\.settles \? 'posed' : 'resting'\}/);
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
    // UI-020: the band's confetti is the moment's, only for a scene finished on the learner's own.
    assert.match(render, /confetti=\{scene\.burst && band\.width > 0 \? <Confetti seed=\{`recap:\$\{momentKey \?\? recap\.headline\}`\} started=\{moment\.reached\('burst'\)\} final=\{moment\.final\} reduced=\{moment\.reduced\}/, 'the band has no moment around its confetti');
    assert.match(render, /cloud=\{credit\.settles \? 'posed' : 'resting'\}/);
    assert.match(code, /const strip = progressStripView\(delta\);/, 'the strip is not drawn from the settled delta');
    // The strip is EndScene's tile row, still on the moment's beat, and drawn at once and final with no strip.
    assert.match(render, /\{strip !== null && !moment\.reached\('strip'\) \? null : <SceneTiles tiles=\{tiles\} layout=\{tileLayout\} counting final=\{strip === null \|\| moment\.final\} \/>\}/);
    assert.match(code, /const tiles = recapTiles\(stats\);/);
    assert.match(code, /afterSessionStats\(\{ activeSec: measured, phrases: credit\.showPhrases \? recap\.phrases\.length : 0, xp: strip\?\.xp\?\.value \?\? null \}\)/);
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
