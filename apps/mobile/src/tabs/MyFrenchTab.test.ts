/**
 * My French in the notebook system (Phase 3, 2026-09-27): the level and the
 * can-dos earned, the phrase bank with audio, a sounds map over the inventory,
 * then the conversations. No rank names, no points, and every block only once
 * it has something true to show.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. Its ceiling is honest: it proves the blocks are wired to the modules
 * that decide them, in order and behind their gates, never that a phone drew
 * them. What the blocks say is `myfrench/notebook.test.ts`'s job.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { MY_FRENCH_COPY } from '../myfrench/copy.ts';
import { NOTEBOOK_COPY } from '../myfrench/notebook.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./MyFrenchTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
const BANK = stripComments(read('../myfrench/PhraseBank.tsx'));
const MAP = stripComments(read('../myfrench/SoundsMap.tsx'));

/** Every `<Tag ...>` in a body, whole, counting braces, so a glyph prop's own `/>` is not the end. */
function tags(body: string, tag: string): string[] {
  const found: string[] = [];
  for (const match of body.matchAll(new RegExp(`<${tag}\\b`, 'g'))) {
    let depth = 0;
    for (let i = match.index; i < body.length; i += 1) {
      const char = body[i]!;
      if (char === '{') depth += 1;
      else if (char === '}') depth -= 1;
      else if (char === '>' && depth === 0) {
        found.push(body.slice(match.index, i + 1));
        break;
      }
    }
  }
  return found;
}

/** Every quoted string in a body: the words a learner could end up reading. */
function literals(body: string): string[] {
  return body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? [];
}

/** Where a marker sits in the screen, proven present so ordering is real. */
function at(marker: string): number {
  const i = SCREEN.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

/** A marker's gate is the nearest `gate` before it, and close to it. */
function gated(marker: string, gate: string, within = 200): void {
  const drawn = at(marker);
  const found = SCREEN.lastIndexOf(gate, drawn);
  assert.notEqual(found, -1, `${marker} is drawn with nothing holding it back`);
  assert.ok(drawn - found < within, `the gate on ${marker} is somewhere else on the screen`);
}

describe('My French is the level, the phrases, the sounds and the conversations — notebook Phase 3', () => {
  test('the blocks run level, phrase bank, sounds map, conversations, in that order', () => {
    assert.ok(at('<TabHeader') < at('<LevelPath'), 'something sits above the header');
    assert.ok(at('<LevelPath') < at('<PhraseBank'), 'the phrases sit above the level');
    assert.ok(at('<PhraseBank') < at('<SoundsMap'), 'the sounds sit above the phrases');
    assert.ok(at('<SoundsMap') < at('<Label>{CONVERSATIONS_ROW}</Label>'), 'the conversations sit above the sounds');
    // The rest of the page is quiet doors, after the four blocks.
    assert.ok(at('<Label>{CONVERSATIONS_ROW}</Label>') < at('title={BROWSE_LINE}'), 'the catalogue door sits above the learner\'s own French');
  });

  test('the level is the spine\'s, with the can-dos earned and "here" on the next scene, and no rank anywhere', () => {
    assert.match(FLAT, /const path = levelPathFrom\(missions\);/, 'the path is not built from the spine over the learner\'s progress');
    assert.match(FLAT, /<LevelPath levels=\{path\.levels\} \/>/, 'the level path draws something other than the model\'s levels');
    assert.match(FLAT, /\{levelLine\(path\.level\)\}/, 'the level is spelled on the screen instead of read from the model');
    gated('<LevelPath', "status === 'ready' &&");
    for (const rank of ['levelFor(', 'totalXp(', 'levelName', 'LEVELS[', 'Beginner', 'Veteran']) {
      assert.ok(!SCREEN.includes(rank), `My French reaches for ${rank}; rank names and points stay internal`);
    }
    assert.doesNotMatch(SCREEN, /\b(xp|points?|rank)\b/i, 'My French names points or a rank; they stay internal');
    // The one highlighter on the page is the level path's "you are here".
    assert.ok(!SCREEN.includes('<Highlight'), 'a second highlighter is drawn beside the level path\'s');
    assert.ok(!/accent\.feature|\bhighlight\b/.test(SCREEN), 'the tab reaches for the chartreuse itself');
  });

  test('a first visit reads one line on what will collect here, and nothing empty', () => {
    assert.match(FLAT, /const firstVisit = isFirstVisit\(\{ progress: missions, deck, checks, packs: packs\.length \}\);/, 'the tab decides for itself what a first visit is');
    gated('{NOTEBOOK.firstVisit}', 'firstVisit &&', 120);
    gated('<PhraseBank', 'bank.length > 0 &&');
    gated('<SoundsMap', 'map.show &&');
    gated('<Label>{CONVERSATIONS_ROW}</Label>', 'model.showConversations &&', 120);
  });

  test('the phrase bank is the newest kept phrases with audio, and one door to all of them', () => {
    assert.match(FLAT, /const bank = phraseBankFrom\(\{ deck, voice, recordings: TUTOR_DAILY_AUDIO, items: DAILY_ITEMS \}\);/, 'the bank is not chosen by the model over the deck and the bundled recordings');
    assert.match(FLAT, /const voice = dailyTutorVoice\(profile\.tutorVoice\);/, 'the recordings are not the learner\'s chosen tutor');
    assert.match(FLAT, /<Label>\{SHELF_LABEL\}<\/Label>/, 'the phrase bank lost its heading');
    assert.match(FLAT, /<LedgerRow glyph=\{<QuoteGlyph color=\{paper\.ink\} \/>\} title=\{SHELF_OPEN\} onPress=\{\(\) => nav\.navigate\('Phrasebook'\)\} \/>/, 'the bank has no door to the whole phrasebook');
    // French in Fraunces, and the audio says whose voice it is.
    assert.match(BANK, /type\.frenchSm/, 'the kept French is not set in the French face');
    assert.match(BANK, /\{row\.audio\.label\}/, 'a row plays without saying whose voice it is');
    assert.match(BANK.replace(/\s+/g, ' '), /if \(row\.audio\.kind === 'recorded'\) \{ recorded\.toggle\(row\.audio\.asset\); return; \}/, 'a recorded phrase is played through the phone\'s voice');
  });

  test('the sounds map lays the inventory out example word first, and marks only what a measured check called out', () => {
    assert.match(FLAT, /const map = soundsMapFrom\(checks, now\);/, 'the map decides for itself what counts as measured');
    assert.match(FLAT, /<SoundsMap cells=\{map\.cells\} \/>/);
    const flatMap = MAP.replace(/\s+/g, ' ');
    assert.ok(flatMap.indexOf('{cell.example}') < flatMap.indexOf('/${cell.ipa}/'), 'the symbol leads the word');
    assert.match(flatMap, /\{cell\.calledOut && /, 'a mark is drawn for a sound no check called out');
    for (const invented of ['score', 'percent', '%', 'mastered', 'accuracy', 'tint', 'accent.feature']) {
      assert.ok(!MAP.toLowerCase().includes(invented.toLowerCase()), `the sounds map reaches for ${invented}`);
    }
    // The measured door stays: it opens the journey or the check it came from.
    assert.match(FLAT, /const fingerprint = soundFingerprint\(checks\)/);
    assert.match(FLAT, /journey !== null \? nav\.navigate\('SoundJourney'\) : nav\.navigate\('SoundCheck', \{ missionId: fingerprint\.missionId \}\)/);
    assert.match(FLAT, /accessibilityLabel=\{soundDoorLabel\(journey\)\}/);
    for (const kind of ["'assessed-focus'", "'assessed-clear'", "'self-guided'", "'unavailable'"]) {
      assert.ok(!SCREEN.includes(kind), `the tab branches on ${kind}; measured evidence belongs to sounds.ts and notebook.ts`);
    }
  });

  test('the conversations lead with their progress sentence and open their own conversation', () => {
    assert.match(FLAT, /const recent = recentConversations\(\{ packs, events: history \}\)/);
    assert.match(FLAT, /const progress = progressStatement\(allConversations\(\{ packs, events: history \}\)\)/);
    assert.match(FLAT, /\{progress !== null && /);
    assert.match(FLAT, /nav\.navigate\('Conversations', \{ packId: row\.pack\.id \}\)/);
    assert.match(FLAT, /label=\{row\.pack\.title\.en\} title=\{row\.preview\.join\(' · '\)\} note=\{row\.line\} accessibilityLabel=\{row\.accessibilityLabel\}/, 'a recent row reads a partial label to a screen reader');
    assert.equal((SCREEN.match(/title=\{RECENT_ALL\}/g) ?? []).length, 1, 'the library has more than one door, or none');
    assert.match(FLAT, /setHistory\(sameAccount\(\) \? \[\.\.\.events, \.\.\.legacyMarkItems\(marks\)\] : \[\]\)/);
  });

  test('the page is ledger rows and nothing louder: no pill, no tint, no retired row', () => {
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 0, 'My French draws a primary pill; this page asks for nothing');
    for (const gone of ['<TintRow', '<IconRowCard', '<SituationsCard', 'tint=', 'missionTint(', '<OutlineButton', '<Stat']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is on My French; the notebook page is ledger rows`);
    }
    assert.ok(SCREEN.includes('<Ledger'), 'the rows are not in a ledger');
  });

  test('every row goes somewhere and names itself', () => {
    const rows = tags(FLAT, 'LedgerRow');
    assert.ok(rows.length >= 6, `only ${rows.length} rows found, so this proves little`);
    for (const row of rows) {
      assert.match(row, /onPress=\{/, `a row on My French goes nowhere: ${row.slice(0, 80)}`);
    }
  });

  test('saved scenes, goals and the daily collection keep their gates and their doors', () => {
    gated('<Label>{SAVED_LABEL}</Label>', 'model.showSaved &&', 160);
    assert.match(FLAT, /nav\.navigate\('Convo', \{ seedTopic: seedTopicOf\(row\.scenario\) \}\)/);
    assert.match(FLAT, /const goals = goalRows\(profile\.learnerGoals, MISSIONS\);/);
    gated('goals.map(', 'goals.length > 0 &&', 160);
    assert.match(FLAT, /nav\.navigate\('GoalStep', \{ key: goalRouteKey\(row\.goal\) \}\)/);
    assert.match(FLAT, /accessibilityLabel=\{DAILY_OPEN\} onPress=\{\(\) => nav\.navigate\('DailyLibrary'\)\}/);
    assert.match(FLAT, /accessibilityLabel=\{BROWSE_OPEN\} onPress=\{\(\) => nav\.navigate\('Missions'\)\}/);
  });

  test('every read is bound to the account, once a visit, and a failed read says so', () => {
    assert.match(FLAT, /const scope = scopeGeneration\(\); const sameAccount = \(\): boolean => !cancelled && scopeGeneration\(\) === scope;/);
    for (const store of ['loadMissionCompletions()', 'loadDeck()', 'loadBookmarks()', 'loadSoundChecks()', 'loadConversationPacks()']) {
      assert.equal(SCREEN.split(store).length - 1, 1, `${store} is read more or less than once a visit`);
    }
    assert.match(FLAT, /useState<'loading' \| 'ready' \| 'unread'>\('loading'\)/);
    assert.match(FLAT, /setStatus\(\(current\) => \(current === 'ready' \? 'ready' : 'unread'\)\)/);
    assert.match(FLAT, /\[user, adapter, attempt\]/);
    gated('title={MY_FRENCH_UNREAD}', "status === 'unread' &&", 400);
  });

  test('every word is a module\'s, and clean', () => {
    for (const line of [...MY_FRENCH_COPY, ...NOTEBOOK_COPY]) {
      assert.ok(!SCREEN.includes(`'${line}'`), `My French spells "${line}" itself`);
    }
    for (const line of [...literals(SCREEN), ...literals(BANK), ...literals(MAP)]) {
      assert.equal(guiltIn(line), undefined, `My French says ${line}, which carries a banned word`);
      assert.doesNotMatch(line, /—/, `${line} carries an em dash`);
    }
    for (const claim of ['mastered', 'fluent', 'CEFR', 'score', 'percent']) {
      assert.ok(!SCREEN.includes(claim), `My French claims ${claim}`);
    }
  });

  test('the page grows with the reading size instead of clipping', () => {
    for (const body of [SCREEN, BANK, MAP]) {
      for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'fontSize', 'flexGrow']) {
        assert.ok(!body.includes(capped), `My French writes ${capped}`);
      }
      assert.doesNotMatch(body, /(width|height|maxHeight): \d/, 'My French pins a size in points');
    }
  });
});

describe('My French speaks, and stops — F470', () => {
  const HERE = fileURLToPath(new URL('../myfrench/', import.meta.url));
  const SPEAKERS = readdirSync(HERE).filter((name) => name.endsWith('.tsx'));

  test('anything that starts a voice also stops one when it goes, and says what it will play', () => {
    for (const name of SPEAKERS) {
      const body = stripComments(read(`../myfrench/${name}`));
      const plays = (body.match(/tutorVoice\.speak\(/g) ?? []).length;
      if (plays === 0) continue;
      assert.match(body.replace(/\s+/g, ' '), /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/, `${name} starts a voice and never stops it`);
      // 2026-09-27, notebook Phase 4 (B2): a label may also come from
      // `phraseControlLabel`, which says Hear at rest and Stop while it plays
      // (held below). Every speaker is still labelled, one label per voice.
      assert.equal(
        (body.match(/accessibilityLabel=\{(?:`Hear |phraseControlLabel\()/g) ?? []).length,
        plays,
        `${name} plays ${plays} things and labels a different number`,
      );
    }
    assert.ok(SPEAKERS.includes('PhraseBank.tsx'));
  });

  // 2026-09-27, Phase 3 review (P2), reopening F470: My French and Practice
  // stay mounted when the learner switches tab, so an unmount-only stop never
  // ran and a voice or a recording followed the learner off the tab.
  test('leaving the tab or the app stops a voice or a recording that My French or Practice started', () => {
    const bank = BANK.replace(/\s+/g, ' ');
    const player = stripComments(read('../practice/recordedPlayer.ts')).replace(/\s+/g, ' ');
    for (const [name, body] of [['PhraseBank.tsx', bank], ['recordedPlayer.ts', player]] as const) {
      assert.match(body, /const focused = useIsFocused\(\);/, `${name} cannot tell when its tab loses focus`);
      assert.match(body, /if \(!focused\) /, `${name} does nothing when its tab loses focus`);
      assert.match(body, /AppState\.addEventListener\('change', \(state\) => \{ if \(state !== 'active'\) /, `${name} keeps playing when the app goes to the background`);
      assert.match(body, /subscription\.remove\(\)/, `${name} leaves its background listener behind`);
    }
    // The bank stops only a voice it started, so a blur never silences the next screen.
    assert.match(bank, /if \(speakingRef\.current !== null\) \{ tutorVoice\.stop\(\);/, 'the bank stops a voice it did not start, or none at all');
    assert.match(bank, /recorded\.stop\(\)/, 'the bank leaves its recording playing');
    // The player lets go of its own recording, and cancels one still loading.
    assert.match(player, /const stop = useCallback\(\(\) => \{ gate\.cancel\(\); releaseDailyPlayback\(player\);/, 'stopping the player leaves a loading recording free to start');
  });

  test('the phrase control says Stop to a screen reader while it plays', async () => {
    const { phraseControlLabel } = (await import('../myfrench/notebook.ts')) as {
      phraseControlLabel?: (fr: string, voice: string, playing: boolean) => string;
    };
    assert.equal(typeof phraseControlLabel, 'function', 'there is no one place that says what the phrase control will do');
    const rest = phraseControlLabel!('Bonjour', 'Your phone reads this one', false);
    const playing = phraseControlLabel!('Bonjour', 'Your phone reads this one', true);
    assert.equal(rest, 'Hear Bonjour. Your phone reads this one');
    assert.equal(playing, 'Stop Bonjour');
    assert.match(BANK.replace(/\s+/g, ' '), /accessibilityLabel=\{phraseControlLabel\(row\.fr, row\.audio\.label, isPlaying\(row\)\)\}/, 'the control announces Hear while it shows Stop');
  });

  test('nothing here listens, records or scores', () => {
    for (const name of [...SPEAKERS.map((n) => `../myfrench/${n}`), './MyFrenchTab.tsx']) {
      const body = stripComments(read(name));
      for (const listening of ['useAudioRecorder', 'SpeakCircle', 'scoreRecordedAttempt', 'consumeRecording', 'RecordingPresets']) {
        assert.ok(!body.includes(listening), `${name} reaches for ${listening}; nothing on this tab records`);
      }
    }
  });
});
