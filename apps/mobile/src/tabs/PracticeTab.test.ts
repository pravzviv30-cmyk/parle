/**
 * What the Practice tab is allowed to draw, and what it must not decide.
 *
 * The tab was the authored path, then the archive of everything the learner had
 * ever said, then one question and three rows (F574). The notebook redesign
 * (Phase 3, 2026-09-27) makes sound its signature: the page leads with "Your
 * sound to tune", then the recommended card, then the made-from rows and due
 * review as ledger rows, each drawn only when it can start. On day one the one
 * pill is the guided lesson that opens on "bonjour".
 *
 * Ceiling, stated plainly because it is easy to overstate what this proves:
 * this reads the tab as text. It cannot see a card on a phone, and it cannot
 * tell you the step is the right one, which is `practice/practiceCard.test.ts`
 * and `practice/soundLead.test.ts`'s job. What it can prove is that the
 * decisions are made THERE and not here, because a screen that can count is a
 * screen that can draw a nought.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One line, so a regex about an expression reads code and not the wrapping. */
const flat = (body: string): string => body.replace(/\s+/g, ' ');

const SCREEN = stripComments(read('./PracticeTab.tsx'));
const FLAT = flat(SCREEN);
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

/**
 * The text between two markers, with both proven present.
 *
 * `indexOf` answers -1 for something that is not there, and a slice taken from
 * -1 is a slice of the wrong part of the file, so every assertion after it
 * would be asked of text nobody wrote.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/** Where a marker sits on the screen, proven present so ordering is real. */
function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

describe('Practice leads with a useful action, then a sound example', () => {
  test('the page puts the short action before the optional sound guide', () => {
    assert.ok(at('<TabHeader') < at('<TuneSoundCard'), 'the tab header is not first');
    assert.ok(at('<Label>{NEXT_STEP.label}</Label>') < at('<TuneSoundCard'), 'the recommendation falls below the sound guide');
    assert.ok(at('<TuneSoundCard') < at('{rowsCanStart && ('), 'the sound example sits under the practice rows');
    // The model reads the stores the tab already reads and the bundled audio,
    // and nothing about which sound, which word or which recording is here.
    assert.match(
      FLAT,
      /setLead\(soundLead\(\{ checks, now, voice, recordings: TUTOR_DAILY_AUDIO, items: DAILY_ITEMS \}\)\)/,
      'the sound is not chosen by practice/soundLead.ts over the stored checks and the bundled recordings',
    );
    assert.match(FLAT, /\{ownerMatches && lead !== null && \(/, 'the sound block draws before the model has answered or after its owner changed');
    for (const decided of ['getPhoneme(', 'FRENCH_PHONEMES', 'isMeasuredCheck(', 'soundFocus(', 'tutorAudioFor(', '.examples[']) {
      assert.ok(!SCREEN.includes(decided), `the tab works out ${decided} itself; that belongs to practice/soundLead.ts`);
    }
  });

  test('native audio is a bundled recording played on its own player, and the phone\'s voice never stands in', () => {
    // The card is handed the tab's recorded player, and only the recording.
    const card = between(RENDER, '<TuneSoundCard', '/>', 'the tab draws the sound card');
    assert.match(card, /onHear=\{hearRecording\}/, 'the sound is heard through something other than the recorded player');
    const hear = between(SCREEN, 'const hearRecording = (', '\n  };\n', 'the recording is played by a component-level handler');
    assert.match(hear, /recorded\.toggle\(asset\)/, 'the sound is heard through something other than the recorded player');
    assert.match(hear, /tutorVoice\.stop\(\)/, 'a synthesised line keeps talking over the recording');
    assert.ok(!/tutorVoice\.speak/.test(hear), 'the phone\'s voice stands in for the recording');
    assert.match(card, /playing=\{recorded\.playing\}/, 'the card cannot say it is already playing, so a second tap has nothing to stop');
    assert.match(FLAT, /const recorded = useRecordedLine\(\);/, 'the tab plays recordings through a player of its own making');
    // A voice started here, recorded or synthesised, stops when the tab goes.
    assert.match(FLAT, /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/, 'a synthesised line follows the learner off the tab');
    // The tab reads the learner's chosen voice, and never another one.
    assert.match(FLAT, /const voice = dailyTutorVoice\(profile\.tutorVoice\);/, 'the recordings are not the learner\'s chosen tutor');
    // The app keeps no recording of the learner (speech/discardRecording.ts),
    // so no player on this tab can play one.
    for (const own of ['recorder.uri', 'useAudioRecorder', 'RecordingPresets', 'consumeRecording', 'lead.own']) {
      assert.ok(!SCREEN.includes(own), `the tab reaches for ${own}; the app keeps no recording of the learner to play`);
    }
  });

  test('day one\'s one pill is the bonjour sound lesson, with its live-minutes line, in the recommendation', () => {
    // Day one is the model's answer, not the tab's: the card's action is the lesson.
    assert.match(FLAT, /const dayOne = ownerMatches && step !== null && step\.card\.action\.kind === 'lesson';/, 'the tab decides for itself what day one is, or shows the previous account’s lesson');
    const card = between(RENDER, '<Label>{NEXT_STEP.label}</Label>', '</Card>', 'the recommended action');
    assert.match(RENDER, /\{primary\}/, 'the day-one action is not next to the preview');
    // The primary is built once and drawn in exactly one of two places.
    const primary = between(SCREEN, 'const primary = ', '\n  );\n', 'the one primary action is built once');
    assert.match(flat(primary), /<PillButton label=\{step\.card\.action\.label\} disabled=\{checking\} onPress=\{startRecommended\} \/>/, 'the pill spells its own label or opens something of its own');
    assert.match(flat(primary), /\{step\.card\.liveMinutes !== null && <Text style=\{st\.costLine\}>\{step\.card\.liveMinutes\}<\/Text>\}/, 'the lesson does not say it uses live minutes');
    assert.match(flat(primary), /\{step\.card\.noMinutes !== null && <Text style=\{st\.costLine\}>\{step\.card\.noMinutes\}<\/Text>\}/, 'a module sitting does not say it uses no live minutes');
    // The lesson is probed like the chooser's door, and goes either way: it
    // runs live while a tutor is connected and on this phone when not.
    const handler = between(SCREEN, 'const startRecommended = () => {', '\n  };\n', 'the recommended action is a component-level handler');
    assert.match(handler, /if \(action\.kind === 'lesson'\) return openLesson\(\);/, 'the day-one action does not open the lesson');
    const lesson = between(SCREEN, 'const openLesson = (', '\n  };\n', 'the lesson opener is a component-level handler');
    assert.match(lesson, /if \(checking \|\| !ownsReadNow\(\)\) return;/, 'a second tap or an old account’s action opens a lesson');
    assert.ok(lesson.indexOf('setChecking(true)') >= 0 && lesson.indexOf('setChecking(true)') < lesson.indexOf('recheck()'), 'the tap is acknowledged after the network is touched');
    assert.match(flat(lesson), /const start = lessonStart\(false\); nav\.navigate\(start\.screen, start\.params\);/, 'the lesson opens somewhere other than where gate.ts says');
    assert.match(flat(lesson), /void recheck\(\)\.then\(answered => \{ if \(answered\) go\(\); else/, 'a failed probe leaves the lesson unopened, and it runs offline too');
    // The one sentence about what the page becomes is day one's, and only day one's.
    assert.match(FLAT, /\{dayOne && <Text style=\{st\.starterLine\}>\{STARTER\.line\}<\/Text>\}/, 'the day-one sentence is drawn for a learner who has had a conversation');
  });

  test('the tab keeps exactly one primary pill, whichever day it is', () => {
    assert.equal((SCREEN.match(/<PillButton/g) ?? []).length, 1, 'a second primary pill was added somewhere on the tab');
    // The same recommendation card serves both a starter and returning learner.
    assert.match(FLAT, /\{ownerMatches && step !== null && \( <View style=\{st\.block\}> \{dayOne \? <NextTaskCard \/> : <Card/, 'the one card does not serve both starter and returning learners, or survives an account switch');
    const card = RENDER.slice(at('<Label>{NEXT_STEP.label}</Label>'), at('<Ledger'));
    assert.match(RENDER, /\{primary\}/, 'the card\'s control is something other than the one primary');
    for (const loud of ['<OutlineButton', '<PillButton']) {
      assert.ok(!between(RENDER, '<TuneSoundCard', '/>', 'the sound card').includes(loud), `the sound card draws its own ${loud}`);
    }
  });

  test('the recommended card previews one French line the sitting will not ask for', () => {
    const card = RENDER.slice(at('<Label>{NEXT_STEP.label}</Label>'), at('<Ledger'));
    assert.match(card, /<Label>\{NEXT_STEP\.label\}<\/Label>/, 'the card spells its own label instead of reading it from nextStep.ts');
    assert.match(card, /french=\{step\.card\.phrase\.fr\}/, 'the card draws something other than the model\'s own French line');
    assert.match(card, /english=\{step\.card\.phrase\.en\}/, 'the line is shown with no meaning beside it');
    assert.match(card, /playing=\{playing\}/);
    assert.match(card, /onHear=\{\(\) => hearNext\(step\.card\.phrase\.fr\)\}/, 'the card hears something other than the line it shows');
    // The preview-leak rule lives in practiceCard.ts; the tab hands it the
    // saved sitting's own phrases so a resume never previews its own answer.
    assert.match(FLAT, /const card = practiceCard\(\{ rec, deck, packs, now, resuming: saved\?\.targets\.map\(\(t\) => t\.phraseKey\) \?\? \[\] \}\)/, 'the card can preview a line the resumed sitting asks for');
    assert.match(FLAT, /const rec = recommendation\(\{ resumable: resumableOf\(saved, packs, bank\), deck, bank, packs, now \}\)/, 'the card is not chosen by the balanced selector over real bank material and the saved sitting');
    const primary = between(SCREEN, 'const primary = ', '\n  );\n', 'the one primary action is built once');
    assert.ok(flat(primary).indexOf('{step.card.source !== null && ') < flat(primary).indexOf('<PillButton'), 'the source is not said above the action it belongs to');
    assert.match(flat(primary), /\{heldBack !== null && \(/, 'a start that was refused has no way forward on the page');
  });

  test('the ways to practise are ledger rows, each drawn only when it can start', () => {
    const ledger = between(RENDER, '{rowsCanStart && (', '</Ledger>', 'the rows sit in one ledger');
    // The replay row opens only a sitting that would hold something (the
    // sayable rule), and the phrase row only when there is a phrase.
    assert.match(flat(ledger), /\{made\?\.value\?\.replay != null && made\.value\.replay\.sayable && \(/, 'the replay row draws when its sitting would be empty');
    assert.match(flat(ledger), /\{made\?\.value\?\.phrase != null && \(/, 'the phrase row draws with no phrase behind it');
    assert.match(flat(ledger), /\{!dayOne && step !== null && step\.doors\.review !== null && \( <LedgerRow/, 'due review is not a ledger row gated on the deck');
    assert.ok(ledger.indexOf('<ReplayMomentCard') < ledger.indexOf('<MakePhraseCard'), 'the phrase sits above the moment');
    assert.ok(ledger.indexOf('<MakePhraseCard') < ledger.indexOf('step.doors.review'), 'review sits above the made-from rows');
    assert.match(flat(ledger), /onPress=\{\(\) => \{ if \(ownsReadNow\(\)\) nav\.navigate\('Review'\); \}\}/, 'the review row does not open the review deck, or opens it after the account changes');
    // The whole ledger is drawn only when one row in it can start.
    assert.match(FLAT, /\{rowsCanStart && \( <View style=\{st\.block\}>/, 'an empty ledger draws its heading over nothing');
    assert.match(FLAT, /<Label>\{ALTERNATIVES\.label\}<\/Label>/, 'the rows lost their one quiet heading');
    assert.match(SCREEN, /madeFromConversations\(\{ packs, marks, deck, checks, bank, now \}\)/, 'the made-from rows are judged without the bank');
  });

  test('the replay opens the drill on the better line with the moment along', () => {
    assert.match(FLAT, /id: `replay:\$\{made\.value!\.replay!\.packId\}`/);
    assert.match(FLAT, /phraseKeys: \[made\.value!\.replay!\.key\]/);
    assert.match(FLAT, /moment: \{ quote: made\.value!\.replay!\.quote, better: made\.value!\.replay!\.better, why: made\.value!\.replay!\.why \}/);
  });

  test('a half-done completion lands first, a waiting sitting is resumed, and every read is bound to the account', () => {
    const load = between(SCREEN, 'const load = useCallback(', '\n  );\n', 'the tab reads its stores in one callback');
    assert.ok(load.indexOf('recoverPracticeCompletion()') >= 0, 'a completion a previous launch left half-done is never finished');
    assert.ok(load.indexOf('recoverPracticeCompletion()') < load.indexOf('loadPracticeSession()'), 'the saved sitting is read before a pending completion lands');
    assert.match(load, /loadSoundChecks\(\{ strict: true \}\)/, 'unreadable sound evidence is treated as an empty check history');
    assert.match(flat(load), /const scope = scopeGeneration\(\); const userId = user\?\.id \?\? null; const capturedOwner = \{ scope, userId \}; const stale = \(\): boolean => cancelled\(\) \|\| !ownsPracticeRead\(capturedOwner, scopeGeneration\(\), userId, activeUserId\(\)\);/);
    assert.equal((load.match(/if \(stale\(\)\)/g) ?? []).length + (load.match(/if \(!stale\(\)\)/g) ?? []).length + (load.match(/if \(stale\(\) \|\|/g) ?? []).length, 4, 'a read or failed read can be drawn for an account that has changed');
    assert.match(flat(load), /\.catch\(\(\) => \{ if \(!stale\(\)\) \{ setFailureOwner\(\{ scope, userId \}\); setFailed\(true\); \} \}\)/, 'a stale rejection shows the new account a read failure');
    const start = between(SCREEN, 'const startRecommended = () => {', '\n  };\n', 'the recommended action is a component-level handler');
    assert.match(start, /nav\.navigate\('Drill', practiceRouteParams\(\{ origin: 'resume', packId: null, exposed: false \}\)\)/, 'Resume opens something other than the saved sitting');
    assert.match(start, /nav\.navigate\('Drill', action\.params\)/, 'a short practice opens something other than a practice sitting');
    assert.match(start, /if \(action\.kind === 'talk'\) return startFirst\(\);/, 'a live conversation no longer goes through its probe');
    assert.ok(!/navigate\('Convo'/.test(start), 'the recommended action opens a live room, which is not what the card promised');
  });

  test('the quiet doors stay quiet, gated on the model, and the tutor door says it uses live minutes', () => {
    assert.match(FLAT, /\{step\.doors\.choose !== null && <IconAction layout="tile" icon="chat" label=\{step\.doors\.choose\}[^>]*onPress=\{\(\) => \{ if \(ownsReadNow\(\)\) nav\.navigate\('Conversations'\); \}\}/, 'choosing a conversation is not a quiet door to the list or opens stale material');
    assert.match(FLAT, /accessibilityLabel=\{`\$\{step\.doors\.revisit\.label\}\. \$\{step\.doors\.revisit\.uses\}`\}/, 'the tutor door does not say its cost to a screen reader');
    assert.match(FLAT, /\{step\.doors\.revisit !== null && \(/, 'the tutor door is drawn without asking the model');
    assert.match(FLAT, /const revisitAllowed = useContinueArc\(\) === true;/, 'the tutor door is not gated by the shared plan helper');
    assert.ok(!SCREEN.includes('capabilitiesFor('), 'the tab asks the plan table itself instead of through the helper');
    assert.equal((SCREEN.match(/nav\.navigate\('Conversations'\)/g) ?? []).length, 2, 'the archive has more than one door on Practice, or none');
    assert.ok(at('<Ledger') < at('<View style={st.doors}>'), 'the quiet doors sit above the ways to practise');
  });

  test('the door that touches the network guards its tap and says so — F154', () => {
    const handler = between(SCREEN, 'const startFirst = (', '\n  };\n', 'the live conversation is a component-level handler');
    assert.match(handler, /if \(checking \|\| !ownsReadNow\(\)\) return;/);
    assert.ok(handler.indexOf('setChecking(true)') < handler.indexOf('recheck()'));
    assert.match(handler, /setChecking\(false\)/);
    assert.match(handler, /\.catch\(\(\) => \{/);
    assert.match(handler, /setHeldBack/);
    assert.match(FLAT, /\{ownerMatches && checking && \([\s\S]{0,200}accessibilityLiveRegion="polite"[\s\S]{0,200}TUTOR_OFFLINE\.checking/, 'the acknowledgement is either not a live region or not tied to the current account’s flag');
  });

  test('nothing on the page counts, tints or highlights', () => {
    for (const forbidden of ['Math.', 'toFixed', 'dueCards', 'buildPath', 'percent', '%']) {
      assert.ok(!SCREEN.includes(forbidden), `the tab uses ${forbidden}; counting belongs to core and to practice/`);
    }
    for (const gone of ['TintRow', 'MADE_FROM_TINT', 'tint=', 'accent.feature', 'highlight', '<Highlight', 'starterMomentRow', 'PathNodeRow', 'SessionFilters', 'VaultCard', 'archiveFrom']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is on Practice; the notebook page has no tints and no highlighter`);
    }
  });

  // 2026-09-27, notebook redesign Phase 3: the whole ban from the retired "the path, the archive and the
  // suggestion card are gone" test, carried over so the suggestion card (ScenarioCard, seedTopicFor,
  // mixOffered) cannot come back beside the sound-led page either. F442 points here.
  test('the path, the archive and the suggestion card stay gone from the sound-led page — F442', () => {
    for (const gone of ['PathNodeRow', 'mixOffered', 'PathUnit', 'units', 'statusLine', 'seedTopicFor', 'ScenarioCard', 'SessionFilters', 'SessionRow', 'VaultCard', 'archiveFrom', 'CLOSING', 'talkAbout']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is back on Practice; the page leads with one sound and its doors`);
    }
  });

  test('every block that can be empty is gated, and a failed read says so', () => {
    assert.match(FLAT, /\{showFailed && \(/, 'a read that never finished leaves the learner on a page that says nothing');
    assert.match(FLAT, /\{ownerMatches && step !== null && \( <View style=\{st\.doors\}>/, 'the doors draw before the card has answered, or after the account changes');
  });

  test('the header says where the page came from, and none of those words live here', () => {
    const header = between(RENDER, '<TabHeader', '/>', 'Practice opens on a TabHeader');
    assert.match(header, /title="Make it feel natural\."/);
    assert.doesNotMatch(header, /purpose=/, 'Practice leads with its useful action, without a repeated subtitle');
    assert.match(SCREEN, /trailing=\{<ProfileButton \/>\}/, 'Practice must retain the shared profile entry point');
    for (const spelled of ['Your sound to tune', 'bonjour', 'Made from your conversations', 'Your next practice', 'Scheduled review', 'Recorded tutor audio']) {
      assert.ok(!SCREEN.includes(spelled), `the tab spells "${spelled}" itself; that word belongs to practice/`);
    }
  });

  test('the page still works for a learner reading at the largest size, and invents no colour or size', () => {
    for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'fontSize']) {
      assert.ok(!SCREEN.includes(capped), `the tab uses ${capped}; type comes from theme.ts and grows with the reader`);
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(SCREEN), 'the tab spells a colour by hand instead of taking one from the palette');
    assert.ok(!/(width|height): \d/.test(SCREEN), 'the tab pins a size in points instead of taking one from the grid');
    assert.ok(!/paddingBottom/.test(SCREEN), 'the tab pads its own bottom over the frame that already pays for the tab bar');
  });

  test('a drill is opened with deck keys, never with the French lines themselves', () => {
    assert.ok(!/phraseKeys: [^}]*\.map\(\(phrase\) => phrase\.fr\)/.test(FLAT), 'a drill is opened with raw French instead of the deck keys it is indexed by');
    const card = readFileSync(new URL('../practice/recommendation.ts', import.meta.url), 'utf8');
    assert.match(card, /pack\.keyPhrases\.map\(\(p\) => phraseKeyOf\(p\.fr\)\)/, 'practice targets must use review-card identities');
  });
});
