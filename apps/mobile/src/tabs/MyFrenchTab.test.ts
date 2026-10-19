/** C2/M2/M3 progress and library wiring. Historical defect titles remain stable.
 * Source checks prove ownership/doors; native reading-size and audio timing
 * require the integrated device journey, not these source assertions.
 */
import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { guiltIn } from '../copy/guilt.ts';
const read = (relative: string): string => readFileSync(new URL(relative, import.meta.url), 'utf8');
function stripComments(source: string): string { return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1'); }
const SCREEN = stripComments(read('./MyFrenchTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
const LIBRARY = stripComments(read('./MyFrenchLibraryTab.tsx'));
const LEARNING = stripComments(read('../main/useMainLearning.ts')).replace(/\s+/g, ' ');
const BANK = stripComments(read('../myfrench/PhraseBank.tsx'));
test("a new account read clears the old evidence before rendering progress", () => {
  assert.match(LEARNING, /old.owner === owner \? \{ \.\.\.old, failed: false \} : \{ owner, data: null, failed: false \}/);
  assert.match(LEARNING, /state.owner === scopeGeneration\(\) \? state.data : null/);
  assert.match(FLAT, /const \{ data, failed, reload \} = useMainLearning\(\)/);
  assert.match(FLAT, /data \? allConversations/);
});

test("the blocks run level, phrase bank, sounds map, conversations, in that order", () => {
  const title = SCREEN.indexOf('<MainScreen title="Your progress"');
  const journal = SCREEN.indexOf('motif="journal"', title);
  const evidence = SCREEN.indexOf('worked.slice', journal);
  const retained = SCREEN.indexOf('<LevelXpCard', evidence);
  assert.ok(title >= 0 && journal > title && evidence > journal && retained > evidence);
  assert.match(LIBRARY, /key: 'conversations'/);
  assert.match(LIBRARY, /key: 'practise'/);
  assert.match(LIBRARY, /key: 'saved'/);
});

test("the level is the spine's, with the can-dos earned and \"here\" on the next scene, and no rank anywhere", () => {
  assert.match(FLAT, /missionStates\(missionCompletionsFrom\(data.completions\), data.deck, Date.now\(\)\).filter\(isEarned\)/);
  assert.match(FLAT, /data !== null && run !== null && run.lifetimeDays > 0/);
  assert.match(FLAT, /<LevelXpCard\/><StreakSummaryCard\/>/);
  assert.doesNotMatch(SCREEN, /levelName|LEVELS\[|brain.cefr\s*=|recordActivity\(/);
});

test("a first visit reads one line on what will collect here, and nothing empty", () => {
  assert.match(FLAT, /failed \? <><MainText>Your learning history could not be loaded/);
  assert.match(FLAT, /!data \? <MainText muted>Loading your learning history/);
  assert.match(FLAT, /worked.length === 0 && earned.length === 0/);
  assert.match(SCREEN, /Your French starts here/);
  assert.doesNotMatch(SCREEN, /sample|fixture|previewPack/);
});

test("the phrase bank is the newest kept phrases with audio, and one door to all of them", () => {
  assert.match(LIBRARY, /libraryPhrases\(data\?\.deck/);
  assert.match(LIBRARY, /card.front/);
  assert.match(LIBRARY, /card.back/);
  assert.match(LIBRARY, /open\('Phrasebook'\)/);
  assert.match(read('../phrases/PhrasebookScreen.tsx'), /onHear=\{canHear\(phrase\)/);
  assert.doesNotMatch(SCREEN, /tutorVoice.speak|useAudioPlayer|useRecordedLine/);
});

test("the sounds map lays the inventory out example word first, and marks only what a measured check called out", () => {
  assert.match(SCREEN, /navigate\('SoundJourney'\)/);
  const journey = read('../soundcheck/SoundJourneyScreen.tsx');
  assert.match(journey, /loadSoundChecks/);
  assert.match(journey, /SoundCheck/);
  assert.doesNotMatch(SCREEN, /accuracy|percent|mastered/);
});

test("the conversations lead with their progress sentence and open their own conversation", () => {
  assert.match(FLAT, /allConversations\(\{ packs: data.packs, events: data.history \}\)/);
  assert.match(FLAT, /history.filter\(item => item.line !== null\)/);
  assert.match(FLAT, /navigate\('Conversations', \{ packId: item.pack.id \}\)/);
  assert.match(FLAT, /detail=\{item.line \?\? undefined\}/);
});

test("the page is ledger rows and nothing louder: no pill, no tint, no retired row", () => {
  // The approved visual shell uses rounded feature and row components, while
  // actual counts remain the existing evidence-owned game components.
  assert.match(SCREEN, /<MainScreen/);
  assert.match(SCREEN, /<MainFeature/);
  assert.match(SCREEN, /<MainRow/);
  assert.match(SCREEN, /<CountsGrid phrases=\{data.deck.filter/);
  assert.doesNotMatch(SCREEN, /<TintRow|<IconRowCard|<OutlineButton|<Stat\b/);
});

test("every row goes somewhere and names itself", () => {
  const rows = [...SCREEN.matchAll(/<MainRow\b[^\n]*?\/>/g)].map(m => m[0]);
  assert.ok(rows.length >= 6);
  for (const row of rows) { assert.match(row, /title=/); assert.match(row, /onPress=/); }
  const shared = read('../main/MainUI.tsx');
  assert.match(shared, /accessibilityRole="button"/);
  assert.match(shared, /<Text style=\{\[type.label/);
});

test("saved scenes, goals and the daily collection keep their gates and their doors", () => {
  assert.match(LIBRARY, /open\('DailyLibrary'\)/);
  assert.match(FLAT, /goalRows\(profile.learnerGoals, MISSIONS\)/);
  assert.match(FLAT, /navigate\('GoalStep', \{ key: goalRouteKey\(row.goal\) \}\)/);
  const conversations = read('../conversationPacks/ConversationsScreen.tsx');
  assert.match(conversations, /continueArc === true/);
  assert.match(conversations, /continuationPackId: pack.id/);
});

test("every read is bound to the account, once a visit, and a failed read says so", () => {
  assert.match(LEARNING, /useFocusEffect/);
  assert.match(LEARNING, /let live = true; const owner = scopeGeneration\(\)/);
  assert.match(LEARNING, /if \(!live \|\| owner !== scopeGeneration\(\)\) return;/);
  assert.match(LEARNING, /failed: true/);
  assert.match(SCREEN, /onPress=\{reload\}/);
  assert.match(LEARNING, /return \(\) => \{ live = false; \}/);
});

test("a failed conversation history slice leaves progress unread, never zero", () => {
  assert.match(LEARNING, /loadPracticeHistory\(\)/);
  assert.match(LEARNING, /loadPackMarks\(\)/);
  assert.match(LEARNING, /Promise.all/);
  assert.match(LEARNING, /\.catch\(\(\) => \{ if \(live && owner === scopeGeneration\(\)\)/);
  assert.match(FLAT, /failed \? <><MainText>Your learning history could not be loaded/);
  assert.ok(FLAT.indexOf('failed ?') < FLAT.indexOf('worked.length === 0'));
});

test("every word is a module's, and clean", () => {
  for (const body of [SCREEN, LIBRARY]) for (const match of body.matchAll(/>\s*([A-Za-z][^<{}]*?)\s*</g)) assert.equal(guiltIn(match[1]!), undefined, match[1]);
  for (const claim of ['mastered', 'fluent', 'CEFR', 'percent']) assert.ok(!SCREEN.includes(claim), claim);
  assert.doesNotMatch(SCREEN, /recordActivity\(|gradeCards\(|settleSitting\(/);
});

test("the page grows with the reading size instead of clipping", () => {
  for (const body of [SCREEN, LIBRARY, read('../main/MainUI.tsx')]) {
    assert.doesNotMatch(body, /numberOfLines|maxFontSizeMultiplier|allowFontScaling|ellipsizeMode|fontSize:/);
  }
  const shared = read('../main/MainUI.tsx');
  assert.match(shared, /rowCopy: \{ flex: 1,.*minWidth: 0/);
  assert.match(shared, /featureStack/);
  assert.match(shared, /minHeight: 52/);
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
