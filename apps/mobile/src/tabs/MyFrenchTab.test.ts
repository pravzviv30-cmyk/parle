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
  test('a new account read clears the old evidence before rendering progress', () => {
    assert.match(FLAT, /const scope = scopeGeneration\(\); const sameAccount = \(\): boolean => !cancelled && scopeGeneration\(\) === scope; setReadOwner\(scope\); setReadyOwner\(null\); setStatus\('loading'\); setMissions\(\[\]\); setCompletions\(\[\]\);/);
    assert.match(FLAT, /setReadyOwner\(scope\); setStatus\('ready'\)/);
    assert.match(FLAT, /const renderStatus = ownedReadStatus\(status, readOwner, readyOwner, currentScope\)/);
    assert.match(FLAT, /renderStatus === 'ready' && \( <View style=\{st\.group\}>/);
  });
  test('the blocks run level, phrase bank, sounds map, conversations, in that order', () => {
    assert.ok(at('<TabHeader') < at('<LevelCard'));
    assert.ok(at('<LevelCard') < at('rows.map('));
    for (const retired of ['<PhraseBank', '<SoundsMap', 'title={DAILY_LINE}', 'title={BROWSE_LINE}']) assert.ok(!SCREEN.includes(retired));
  });

  test('the level is the spine\'s, with the can-dos earned and "here" on the next scene, and no rank anywhere', () => {
    assert.match(FLAT, /const path = levelPathFrom\(missions\);/);
    assert.match(FLAT, /<LevelCard path=\{path\} hasFinish=\{hasFinish\} hasEarned=\{hasEarned\} onPress=\{\(\) => nav.navigate\('Missions'\)\}/);
    gated('<LevelCard', "renderStatus === 'ready' &&", 1000);
    const level = read('../myfrench/LevelCard.tsx');
    assert.match(level, /ground="blue"/);
    assert.match(level, /<SceneMark state=\{stop.state\}/);
    assert.match(level, /path.level/);
    assert.match(level, /next.stops.length/);
    assert.doesNotMatch(SCREEN, /totalXp\(|levelName|LEVELS\[/);
  });

  test('a first visit reads one line on what will collect here, and nothing empty', () => {
    assert.match(FLAT, /const firstVisit = isFirstVisit\(\{ progress: missions, deck, checks, packs: packs.length \}\);/);
    gated('{NOTEBOOK.firstVisit}', 'firstVisit &&', 300);
    assert.equal(tags(SCREEN, 'PillButton').length, 2, 'first visit and earned proof each have one scene door');
    assert.match(FLAT, /label="Choose a scene" onPress=\{\(\) => nav.navigate\('Missions'\)\}/);
  });

  test('the phrase bank is the newest kept phrases with audio, and one door to all of them', () => {
    assert.match(FLAT, /phrases: new Set\(deck.filter/);
    assert.match(FLAT, /phraseKeyOf\(card.front\)/);
    assert.match(FLAT, /row.kind === 'phrases'\) nav.navigate\('Phrasebook'\)/);
    assert.doesNotMatch(SCREEN, /tutorVoice.speak|useAudioPlayer|useRecordedLine/);
    assert.match(BANK, /row.audio.label/);
  });

  test('the sounds map lays the inventory out example word first, and marks only what a measured check called out', () => {
    assert.match(FLAT, /sounds: soundsMapFrom\(checks, now\).show/);
    assert.match(FLAT, /row.kind === 'sounds'/);
    assert.match(FLAT, /journey !== null \? 'SoundJourney' : 'SoundCheck'/);
    assert.match(MAP, /cell.calledOut/);
    assert.doesNotMatch(SCREEN, /mastered|accuracy|percent/);
  });

  test('the conversations lead with their progress sentence and open their own conversation', () => {
    assert.match(FLAT, /conversations: allConversations\(\{ packs, events: history \}\).length/);
    assert.match(FLAT, /row.kind === 'conversations'\) nav.navigate\('Conversations'\)/);
    assert.match(FLAT, /setHistory\(\[\.\.\.events, \.\.\.legacyMarkItems\(marks\)\]\); setReadyOwner\(scope\); setStatus\('ready'\)/);
  });

  test('the page is ledger rows and nothing louder: no pill, no tint, no retired row', () => {
    assert.equal(tags(SCREEN, 'PillButton').length, 2, 'proof and first visit are exclusive scene doors');
    assert.match(FLAT, /proof !== null && <Card/);
    assert.equal(tags(SCREEN, 'Ledger').length, 3, 'retry, saved materials and evidence-based stories');
    assert.match(SCREEN, /hasWeek \|\| earnedPostcards\(missions\).length > 0/);
    assert.ok(SCREEN.includes('renderStatus === \'ready\' && rows.length > 0'));
    for (const retired of ['<TintRow', '<IconRowCard', '<OutlineButton', '<Stat']) assert.ok(!SCREEN.includes(retired));
  });

  test('every row goes somewhere and names itself', () => {
    const rows = tags(FLAT, 'LedgerRow');
    assert.equal(rows.length, 4, 'retry, saved materials, week story and postcards');
    for (const row of rows) { assert.match(row, /onPress=\{/); assert.match(row, /accessibilityLabel=(?:\{|")/); }
    assert.match(FLAT, /key=\{row.id\}/);
  });

  test('saved scenes, goals and the daily collection keep their gates and their doors', () => {
    assert.match(FLAT, /goals: goalRows\(profile.learnerGoals, MISSIONS\)/);
    assert.match(FLAT, /saved: model.saved/);
    assert.match(FLAT, /nav.navigate\('Convo', \{ seedTopic: row.seedTopic \}\)/);
    assert.match(FLAT, /nav.navigate\('GoalStep', \{ key: goalRouteKey\(row.title\) \}\)/);
    assert.doesNotMatch(SCREEN, /title=\{DAILY_LINE\}|title=\{BROWSE_LINE\}/);
  });

  test('every read is bound to the account, once a visit, and a failed read says so', () => {
    assert.match(FLAT, /const scope = scopeGeneration\(\); const sameAccount = \(\): boolean => !cancelled && scopeGeneration\(\) === scope;/);
    for (const store of ['loadMissionCompletions()', 'loadDeck()', 'loadBookmarks()', 'loadSoundChecks({ strict: true })', 'loadConversationPacks()', 'loadPracticeHistory()', 'loadPackMarks()']) {
      assert.equal(SCREEN.split(store).length - 1, 1, `${store} is read more or less than once a visit`);
    }
    assert.match(FLAT, /useState<'loading' \| 'ready' \| 'unread'>\('loading'\)/);
    assert.match(FLAT, /if \(sameAccount\(\)\) setStatus\('unread'\)/);
    assert.match(FLAT, /\[user, adapter, attempt\]/);
    gated('title={MY_FRENCH_UNREAD}', "renderStatus === 'unread' &&", 400);
  });

  test('a failed conversation history slice leaves progress unread, never zero', () => {
    const read = FLAT.slice(FLAT.indexOf('void Promise.all(['), FLAT.indexOf(']).then(', FLAT.indexOf('void Promise.all([')));
    assert.match(read, /loadPracticeHistory\(\), loadPackMarks\(\)/);
    assert.match(FLAT, /setHistory\(\[\.\.\.events, \.\.\.legacyMarkItems\(marks\)\]\); setReadyOwner\(scope\); setStatus\('ready'\)/);
    assert.match(FLAT, /if \(sameAccount\(\)\) setStatus\('unread'\)/);
    assert.match(FLAT, /renderStatus === 'ready' && rows\.length > 0/);
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
      if (name === 'recordedPlayer.ts') {
        // Foreground is also read by a tap arriving after the background event.
        assert.match(body, /AppState\.addEventListener\('change', \(state\) => \{ active\.current = state === 'active'; if \(!active\.current\) stop\(\);/, `${name} keeps playing when the app goes to the background`);
      } else {
        assert.match(body, /AppState\.addEventListener\('change', \(state\) => \{ if \(state !== 'active'\) /, `${name} keeps playing when the app goes to the background`);
      }
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
