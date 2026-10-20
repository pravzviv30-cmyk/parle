/**
 * What the Practice tab is allowed to draw, and what it must not decide.
 *
 * 2026-10-20, B3, B-Practice: rewritten for direction B. The tab goes back to
 * the learner's conversations (topic chips, the stopped sitting, patterns that
 * come up often, each conversation with its fixes, three steps and revisit,
 * the mix, saved phrases and text, and the sound doors), or shows the empty
 * page with one pill. Every decision is practice/practiceTabView.ts's, and
 * every read is practice/useLibraryData.ts's. The history below is kept.
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

import { COMES_UP_OFTEN_ENABLED } from '../practice/practiceTabView.ts';

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

describe('Practice goes back to the learner\'s conversations — 2026-10-20, B3, B-Practice', () => {
  test('the page puts the conversations before the optional sound guide', () => {
    // 2026-10-20, B3.1, founder: hide until Phase C. "Comes up often" left the order.
    // Artboard order: chips, pick up, comes up often, your conversations, then
    // the mix, saved phrases and the sound doors.
    const order = ['<TabHeader', 'chips.map(', '{PICK_UP_TITLE}', '{CONVERSATIONS_TITLE}', '{MIX_TITLE}', '{savedRows}', 'Hear, say and compare', '<TuneSoundCard'];
    // savedRows is drawn twice (the empty page draws it too); read the full page.
    const full = RENDER.slice(RENDER.indexOf('!newLearner && (() =>'));
    assert.ok(full.length > 0, 'the full page is not its own branch');
    let last = -1;
    for (const marker of order.slice(1)) {
      const i = full.indexOf(marker);
      assert.notEqual(i, -1, `\`${marker}\` is not on the full page`);
      assert.ok(i > last, `\`${marker}\` is out of the artboard's order`);
      last = i;
    }
    assert.ok(at('<TabHeader') < RENDER.indexOf('!newLearner && (() =>'), 'the tab header is not first');
    // The sound is chosen by practice/soundLead.ts over the stored checks.
    assert.match(FLAT, /soundLead\(\{ checks: data\.checks, now, voice, recordings: TUTOR_DAILY_AUDIO, items: DAILY_ITEMS \}\)/, 'the sound is not chosen by practice/soundLead.ts over the stored checks and the bundled recordings');
    assert.match(FLAT, /\{ownerMatches && lead !== null && \(/, 'the sound block draws before the read has answered or after its owner changed');
    for (const decided of ['getPhoneme(', 'FRENCH_PHONEMES', 'isMeasuredCheck(', 'soundFocus(', 'tutorAudioFor(', '.examples[']) {
      assert.ok(!SCREEN.includes(decided), `the tab works out ${decided} itself; that belongs to practice/soundLead.ts`);
    }
  });

  test('native audio is a bundled recording played on its own player, and the phone\'s voice never stands in', () => {
    const card = between(RENDER, '<TuneSoundCard', '/>', 'the tab draws the sound card');
    assert.match(card, /onHear=\{hearRecording\}/, 'the sound is heard through something other than the recorded player');
    const hear = between(SCREEN, 'const hearRecording = (', '\n  };\n', 'the recording is played by a component-level handler');
    assert.match(hear, /recorded\.toggle\(asset\)/);
    assert.match(hear, /tutorVoice\.stop\(\)/, 'a synthesised line keeps talking over the recording');
    assert.ok(!/tutorVoice\.speak/.test(SCREEN), 'the phone\'s voice stands in for the recording');
    assert.match(card, /playing=\{recorded\.playing\}/);
    assert.match(FLAT, /const recorded = useRecordedLine\(\);/);
    assert.match(FLAT, /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/, 'a voice follows the learner off the tab');
    assert.match(FLAT, /const voice = dailyTutorVoice\(profile\.tutorVoice\);/, 'the recordings are not the learner\'s chosen tutor');
    for (const own of ['recorder.uri', 'useAudioRecorder', 'RecordingPresets', 'consumeRecording', 'lead.own']) {
      assert.ok(!SCREEN.includes(own), `the tab reaches for ${own}; the app keeps no recording of the learner to play`);
    }
    // Hear, say and compare stays a door to the free local practice.
    assert.match(FLAT, /nav\.navigate\('DailyPractice', \{ id: shadowPhrase\.id, mode: 'shadowing' \}\)/);
  });

  test('the empty page\'s one pill is the first conversation, and the café lesson and sounds are ready without one — B-Empty-Practice', () => {
    const empty = between(RENDER, '{data !== null && newLearner && (', '{data !== null && !newLearner', 'the empty page is its own branch');
    assert.match(FLAT, /const newLearner = data !== null && isNewLearner\(data\);/, 'the tab decides for itself who is new');
    assert.match(flat(empty), /\{EMPTY\.title\}/);
    assert.match(flat(empty), /\{EMPTY\.body\}/);
    assert.match(flat(empty), /<PillButton label=\{EMPTY\.start\} disabled=\{checking\} onPress=\{startFirst\} \/>/, 'the empty page\'s pill does not go through the probe');
    assert.match(flat(empty), /\{refused\}/, 'a refused start has no way forward on the empty page');
    assert.match(flat(empty), /\{EMPTY\.readyNow\}/);
    assert.match(flat(empty), /<LedgerRow title=\{EMPTY\.cafe\.title\} gloss=\{EMPTY\.cafe\.line\} note=\{EMPTY\.cafe\.cost\} disabled=\{checking\} onPress=\{openLesson\} \/>/, 'the café lesson opens without its probe, or hides what it costs');
    assert.match(flat(empty), /go\(\{ screen: 'SoundCheck' \}\)/, 'Sounds of French opens somewhere other than the sound check');
    assert.match(flat(empty), /\{savedRows\}/, 'the empty page lost its saved phrases line');
    const lesson = between(SCREEN, 'const openLesson = (', '\n  };\n', 'the lesson opener is a component-level handler');
    assert.match(lesson, /if \(checking \|\| !ownsReadNow\(\)\) return;/);
    assert.ok(lesson.indexOf('setChecking(true)') >= 0 && lesson.indexOf('setChecking(true)') < lesson.indexOf('recheck()'));
    assert.match(flat(lesson), /const start = lessonStart\(false\); nav\.navigate\(start\.screen, start\.params\);/);
  });

  test('the tab keeps exactly one primary pill, whichever day it is', () => {
    const primaries = (SCREEN.match(/<PillButton\b/g) ?? []).length - (SCREEN.match(/<PillButton variant="secondary"/g) ?? []).length;
    assert.equal(primaries, 1, 'a second primary pill was added somewhere on the tab');
    assert.match(FLAT, /<PillButton label=\{EMPTY\.start\}/, 'the one primary is not the first conversation');
    assert.doesNotMatch(SCREEN, /<NextTaskCard/, 'the old recommended card is back beside the conversations');
  });

  test('the pick-up card names the stopped sitting and resumes it', () => {
    assert.match(FLAT, /const resume = pickUp\(\{ saved: data\.session, packs: data\.packs, deck: data\.deck, bank: data\.bank, now \}\);/, 'the stopped sitting is not the recommendation\'s own resume answer');
    const card = between(RENDER, '{resume !== null && (', '</ColourCard>', 'the pick-up card is drawn only when there is a sitting');
    assert.match(card, /onPress=\{\(\) => go\(resume\.route\)\}/);
    assert.match(card, /\{resume\.line\}/);
    // 2026-10-20, lock seam wiring: a resumed sitting is free on main's route guard, so pick up draws no badge.
    assert.doesNotMatch(card, /LockBadge|LOCK_BADGE_LABEL/, 'pick up shows a lock its tap never opens');
  });

  test('every conversation card opens its fixes, three steps and revisit from the view model', () => {
    // 2026-10-20, lock seam wiring: the card reads the reactive seam; the revisit's tap opens the Wall when locked.
    assert.match(FLAT, /const card = conversationCard\(\{ pack, packs: data\.packs, deck: data\.deck, bank: data\.bank, now, revisitAllowed, access: locks\.access \}\);/);
    const card = between(RENDER, '{shown.map((pack) => {', '{data.unavailable.length > 0', 'each conversation is drawn from its card model');
    assert.match(flat(card), /\{card\.fixes !== null && <LedgerRow title=\{card\.fixes\.title\} gloss=\{card\.fixes\.gloss\} onPress=\{\(\) => go\(card\.fixes!\.route\)\} \/>\}/);
    assert.match(flat(card), /\{card\.steps\?\.map\(\(step, i\) => \(/);
    assert.match(flat(card), /onPress=\{\(\) => go\(step\.route\)\}/);
    assert.match(flat(card), /trailing=\{card\.stepsLocked \? <LockBadge form="round" said \/> : undefined\}/);
    assert.match(flat(card), /onPress=\{\(\) => tapThrough\(locks\.access, card\.revisit!\.feature, locks\.open, \(\) => go\(card\.revisit!\.route\)\)\}/);
    assert.match(flat(card), /trailing=\{card\.revisit\.locked \? <LockBadge form="round" said \/> : undefined\}/);
    assert.match(flat(card), /\{card\.kept\.map\(\(fr\) => <Chip key=\{fr\} variant="meta" lang="fr" label=\{fr\} \/>\)\}/, 'kept French is not tagged as French');
    assert.match(flat(card), /revisitedLines\(card\.revisited\)/);
    // Paging through the existing cursor.
    assert.match(FLAT, /\{library\.nextCursor !== null && <OutlineButton label=\{library\.loading \? 'Loading…' : OLDER\}/);
    assert.match(FLAT, /\{library\.olderPage && <OutlineButton label=\{NEWEST\}/);
  });

  // 2026-10-20, B3.1, founder: hide until Phase C.
  test('"Comes up often" is not drawn on Practice or Your fixes while its flag is off', () => {
    assert.equal(COMES_UP_OFTEN_ENABLED, false);
    for (const file of ['./PracticeTab.tsx', '../practice/FixesScreen.tsx']) {
      const source = stripComments(read(file));
      for (const drawn of ['comesUpOften(', 'COMES_UP_TITLE', 'COMES_UP_SHORT', 'PRACTISE_THIS']) {
        assert.ok(!source.includes(drawn), `${file} draws ${drawn} while Comes up often is hidden`);
      }
    }
  });

  test('a fix is tried on Your fixes, not replayed from the tab', () => {
    for (const gone of ['ReplayMomentCard', 'MakePhraseCard', 'madeFromConversations', 'moment:']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is back on Practice; a fix is tried first on Your fixes`);
    }
  });

  test('a half-done completion lands first, a waiting sitting is resumed, and every read is bound to the account', () => {
    assert.match(FLAT, /const library = useLibraryData\(\);/, 'the tab reads its stores somewhere other than the one reader');
    const hook = read('../practice/useLibraryData.ts');
    assert.ok(hook.indexOf('recoverPracticeCompletion()') >= 0, 'a completion a previous launch left half-done is never finished');
    assert.match(hook, /void recoverPracticeCompletion\(\)\.catch\(\(\) => null\)\.then\(read\)/, 'the saved sitting is read before a pending completion lands');
    for (const store of ['loadDeck()', 'loadDrillBank()', 'loadPackMarks()', 'loadTopics()', 'loadSoundChecks({ strict: true })']) {
      assert.ok(hook.includes(store), `the reader no longer reads ${store}`);
    }
    assert.match(hook, /ownsPracticeRead\(owner, scopeGeneration\(\), owner\.userId, activeUserId\(\)\)/, 'a read can be drawn for an account that has changed');
    assert.match(hook, /ownsNow: \(\) => stored !== null && current\(stored\.owner\)/);
    assert.match(FLAT, /const ownsReadNow = \(\) => library\.ownsNow\(\);/);
    const go = between(SCREEN, 'const go = (route: PracticeRoute) => {', '\n  };\n', 'every door goes through one handler');
    assert.match(go, /if \(!ownsReadNow\(\)\) return;/, 'a door opens the previous account\'s material');
  });

  test('the tutor revisit is gated by the shared plan helper and says it uses live minutes', () => {
    assert.match(FLAT, /const revisitAllowed = useContinueArc\(\) === true;/, 'the tutor door is not gated by the shared plan helper');
    assert.ok(!SCREEN.includes('capabilitiesFor('), 'the tab asks the plan table itself instead of through the helper');
    assert.match(FLAT, /accessibilityLabel=\{`\$\{card\.revisit\.label\}\. \$\{card\.revisit\.uses\}/, 'the tutor door does not say its cost to a screen reader');
    // 2026-10-20, lock seam wiring: the tab holds the reactive hook, never the seam's own answer.
    assert.doesNotMatch(SCREEN, /featureAccess\(/, 'the tab asks the access seam itself; the view model does');
    assert.match(FLAT, /const locks = useFeatureAccess\(user\?\.id\);/);
    assert.match(FLAT, /onPress=\{\(\) => tapThrough\(locks\.access, mix\.feature, locks\.open, \(\) => go\(mix\.route\)\)\}/, 'the locked mix starts a drill instead of opening the Wall');
    assert.match(FLAT, /\{mix\.locked && <LockBadge ground="card" said \/>\}/);
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
    for (const forbidden of ['Math.', 'toFixed', 'dueCards', 'buildPath', 'percent', '%', 'evidenceOf', '.length} ']) {
      assert.ok(!SCREEN.includes(forbidden), `the tab uses ${forbidden}; counting belongs to core and to practice/`);
    }
    for (const gone of ['TintRow', 'MADE_FROM_TINT', 'tint=', 'accent.feature', 'highlight', '<Highlight', 'starterMomentRow', 'PathNodeRow', 'SessionFilters', 'VaultCard', 'archiveFrom']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is on Practice; the page has no tints and no highlighter`);
    }
  });

  // 2026-09-27, notebook redesign Phase 3: the whole ban from the retired "the path, the archive and the
  // suggestion card are gone" test, carried over so the suggestion card (ScenarioCard, seedTopicFor,
  // mixOffered) cannot come back beside the sound-led page either. F442 points here.
  test('the path, the archive and the suggestion card stay gone from the sound-led page — F442', () => {
    for (const gone of ['PathNodeRow', 'mixOffered', 'PathUnit', 'units', 'statusLine', 'seedTopicFor', 'ScenarioCard', 'SessionFilters', 'SessionRow', 'VaultCard', 'archiveFrom', 'CLOSING', 'talkAbout']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is back on Practice; the page leads with the learner's conversations`);
    }
  });

  test('every block that can be empty is gated, and a failed read says so', () => {
    assert.match(FLAT, /\{library\.failed && \(/, 'a read that never finished leaves the learner on a page that says nothing');
    assert.match(FLAT, /\{library\.cached && \(/, 'a page drawn from the phone does not say so');
    for (const gate of ['{chips.length > 0 && (', '{resume !== null && (', '{mix !== null && (', '{week !== null && ', '{card.kept.length > 0 && (', '{shadowPhrase && (']) {
      assert.ok(SCREEN.includes(gate), `\`${gate}\` is gone, so an empty block draws its heading over nothing`);
    }
  });

  test('the header says where the page came from, and none of those words live here', () => {
    const header = between(RENDER, '<TabHeader', '/>', 'Practice opens on a TabHeader');
    assert.match(header, /title=\{PRACTICE_TITLE\}/);
    assert.match(header, /purpose=\{newLearner \? EMPTY_SUBTITLE : PRACTICE_SUBTITLE\}/, 'the subtitle is spelled here, or the empty page shares the full one');
    assert.match(SCREEN, /trailing=\{<ProfileButton \/>\}/, 'Practice must retain the shared profile entry point');
    // The ported library opens on the shared frame, never MainUI's or its colour shims.
    for (const file of ['./PracticeTab.tsx', '../practice/useLibraryData.ts', '../practice/FixesScreen.tsx', '../conversationPacks/ConversationPackLibrary.tsx']) {
      assert.doesNotMatch(read(file), /main\/MainUI|useMainAppearance/, `${file} imports MainUI or its appearance shims`);
    }
    assert.match(SCREEN, /<ScrollScreen\b/);
    for (const spelled of ['Go back to your conversations', 'Pick up where you stopped', 'Comes up often', 'Your conversations', 'Mix your conversations', 'Your practice grows from here', 'Practise this conversation']) {
      assert.ok(!SCREEN.includes(spelled), `the tab spells "${spelled}" itself; that word belongs to practiceTabView.ts`);
    }
  });

  test('the page still works for a learner reading at the largest size, and invents no colour or size', () => {
    for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'fontSize']) {
      assert.ok(!SCREEN.includes(capped), `the tab uses ${capped}; type comes from theme.ts and grows with the reader`);
    }
    assert.ok(!/#[0-9a-fA-F]{3,8}\b/.test(SCREEN), 'the tab spells a colour by hand instead of taking one from the palette');
    assert.ok(!/(width|height): \d/.test(SCREEN), 'the tab pins a size in points instead of taking one from the grid');
    assert.ok(!/paddingBottom/.test(SCREEN), 'the tab pads its own bottom over the frame that already pays for the tab bar');
    assert.match(SCREEN, /minHeight: HIT/, 'a title row with a badge falls under the touch floor');
  });

  test('a drill is opened with deck keys, never with the French lines themselves', () => {
    assert.ok(!/phraseKeys: [^}]*\.map\(\(phrase\) => phrase\.fr\)/.test(FLAT), 'a drill is opened with raw French instead of the deck keys it is indexed by');
    const card = readFileSync(new URL('../practice/recommendation.ts', import.meta.url), 'utf8');
    assert.match(card, /pack\.keyPhrases\.map\(\(p\) => phraseKeyOf\(p\.fr\)\)/, 'practice targets must use review-card identities');
    const view = read('../practice/practiceTabView.ts');
    assert.match(view, /phraseKeyOf\(c\.better\)/, 'a pattern drill is opened on raw French');
  });
});

// 2026-10-20, sim nits: the empty page's Sounds of French row draws the seam's round lock, said once.
test('Sounds of French carries the round lock from the seam, heard once', () => {
  const src = flat(SCREEN);
  assert.match(src, /const sounds = soundsRow\(locks\.access\);/);
  assert.match(src, /trailing=\{sounds\.locked \? <LockBadge form="round" said \/> : undefined\}/);
  assert.match(src, /accessibilityLabel=\{`\$\{sounds\.title\}, \$\{sounds\.gloss\}\$\{sounds\.locked \? `, \$\{LOCK_BADGE_LABEL\}` : ''\}`\}/);
});
