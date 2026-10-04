/**
 * The listening preview control, read as source (Stage 4, item 4).
 *
 * No renderer here (docs/TESTING.md). This proves the control draws what
 * `preview.ts` decided, plays the recording the way the daily cards do, speaks
 * only through the device voice module, never records or reaches the network,
 * and is mounted on the chooser as a quiet control rather than a second pill.
 * The judgements about which source plays are `preview.test.ts`'s.
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, test } from 'node:test';

import { LESSON_MINUTES } from '../copy/access.ts';
import { LESSON_DOOR } from './chooserView.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const CONTROL = stripComments(read('./ListeningPreview.tsx'));
const FLAT = CONTROL.replace(/\s+/g, ' ');

describe('the listening preview control — Stage 4 item 4', () => {
  test('every decision is preview.ts’s, for the learner’s chosen voice and this phone’s French', () => {
    // Stage 4 lead review (2026-09-25): the phone is asked, so its answer
    // starts unknown, and preview.ts is given a real yes only.
    assert.match(FLAT, /previewFor\(selection, \{ voice, recordings: TUTOR_DAILY_AUDIO, deviceFrench: deviceFrench === true \}\)/);
    assert.match(FLAT, /const voice = dailyTutorVoice\(profile\.tutorVoice\);/, 'the preview picks a voice the learner did not choose');
    assert.match(FLAT, /tutorVoice\.available\(\)/, 'the device voice is assumed rather than asked for');
    for (const label of ["'Recorded tutor audio'", "'Device voice'", "'Text only", 'Authored example']) {
      assert.ok(!CONTROL.includes(label), `the control spells ${label} itself instead of reading preview.ts`);
    }
    assert.match(FLAT, /\{preview\.label\}/);
    assert.match(FLAT, /\{preview\.note\}/, 'the preview does not say it is an authored example');
  });

  test('a recording plays the way the daily cards play it, and the device voice only when that is the label', () => {
    assert.match(FLAT, /claimDailyPlayback\(player\)/);
    assert.match(FLAT, /ownsDailyPlayback\(player\)/);
    assert.match(FLAT, /releaseDailyPlayback\(player\)/, 'leaving the screen leaves the recording playing');
    assert.match(FLAT, /preview\.audio === 'recorded' && preview\.asset !== undefined/);
    assert.match(FLAT, /player\.replace\(preview\.asset\)/);
    assert.match(FLAT, /preview\.plays === 'all'/, 'the device voice is used on a preview labelled otherwise');
    assert.match(FLAT, /tutorVoice\.speakLines\(/);
    assert.match(FLAT, /tutorVoice\.stop\(\)/, 'the device voice keeps talking after the preview closes');
    assert.match(FLAT, /preview\.plays !== 'none' && /, 'a text-only preview offers a play control that plays nothing');
  });

  test('it names no source until it knows one, and says when only the first line plays — Stage 4 lead review', () => {
    // Before the phone has answered, "Text only: no French voice on this
    // device" would be a guess, and on a phone with a French voice a false
    // one. So the answer starts unknown, and the source line and the play
    // control wait for it, except for a bundled recording, which is known.
    assert.match(FLAT, /const \[deviceFrench, setDeviceFrench\] = useState<boolean \| null>\(null\);/, 'the device voice starts as a no rather than as unknown');
    assert.match(FLAT, /const sourceKnown = preview\.audio === 'recorded' \|\| deviceFrench !== null;/);
    assert.match(FLAT, /\{sourceKnown && <Text[^>]*>\{preview\.label\}<\/Text>\}/, 'the source is named before it is known');
    assert.match(FLAT, /\{sourceKnown && preview\.plays !== 'none' && \(/, 'a play control is offered before the source is known');
    // A recorded situation shows every line and plays only the first, so the
    // control says so rather than promising the whole example.
    assert.match(FLAT, /label=\{preview\.plays === 'first' \? PREVIEW_COPY\.playFirst : PREVIEW_COPY\.play\}/, 'the play control promises every line when only the first is recorded');
  });

  test('it goes quiet when the learner leaves the chooser — Stage 4 review (2026-09-25)', () => {
    // The chooser stays mounted under a native stack when "Start mission"
    // pushes Convo or a lesson door pushes Lesson, so an unmount alone never
    // comes. A blur stops it and so does the app leaving the foreground, the
    // way the daily cards stop theirs (`daily/DailyCard.tsx`).
    assert.match(CONTROL, /^import \{ useIsFocused \} from '@react-navigation\/native';$/m, 'the preview cannot tell that its screen was covered');
    assert.match(FLAT, /const focused = useIsFocused\(\);/);
    assert.match(
      FLAT,
      /useEffect\(\(\) => \{ return \(\) => silence\(\); \}, \[open, focused, player, voice, silence\]\);/,
      'a blur leaves the preview playing under the next screen',
    );
    assert.match(
      FLAT,
      /const subscription = AppState\.addEventListener\('change', \(state\) => \{ if \(state !== 'active'\) silence\(\); \}\); return \(\) => subscription\.remove\(\);/,
      'the preview keeps playing after the app goes to the background',
    );
    // Silencing stops both sources, and the Stop control is the same act.
    assert.match(
      FLAT,
      /const silence = useCallback\(\(\) => \{ ticket\.current \+= 1; releaseDailyPlayback\(player\); stopOwnVoice\(\); \}, \[player, stopOwnVoice\]\);/,
      'leaving stops only one of the two sources',
    );
    assert.match(FLAT, /<GhostButton label=\{PREVIEW_COPY\.stop\} color=\{ink\} onPress=\{silence\} \/>/);
  });

  test('it stops the device voice only when it started it — Stage 4 review (2026-09-25)', () => {
    // `tutorVoice.stop()` is global: a preview that stopped it on every blur
    // would cut off whatever the next screen's tutor was saying.
    assert.equal((CONTROL.match(/tutorVoice\.stop\(\)/g) ?? []).length, 1, 'the device voice is stopped somewhere the ownership check does not cover');
    assert.match(FLAT, /const speaking = useRef\(false\);/);
    assert.match(
      FLAT,
      /const stopOwnVoice = useCallback\(\(\) => \{ if \(!speaking\.current\) return; speaking\.current = false; tutorVoice\.stop\(\); \}, \[\]\);/,
      'the device voice is stopped whether or not this preview started it',
    );
    assert.match(
      FLAT,
      /speaking\.current = true; tutorVoice\.speakLines\(preview\.lines\.map\(\(line\) => line\.fr\), \(\) => \{ if \(ticket\.current === mine\) speaking\.current = false; \}\);/,
      'the preview does not mark the voice as its own, or a stale finish clears a newer one',
    );
    const recorded = FLAT.slice(FLAT.indexOf("if (preview.audio === 'recorded'"), FLAT.indexOf('claimDailyPlayback(player)'));
    assert.ok(recorded.includes('stopOwnVoice();'), 'a recording plays over this preview’s own device voice');
  });

  test('it does not repeat the host’s own description unless asked — Stage 4 review (2026-09-25)', () => {
    // On the chooser's hero the context line is the goal line drawn just
    // above it, so the host opts in rather than out.
    assert.match(FLAT, /export function ListeningPreview\(\{ selection, showContext = false, ground = 'white' \}: \{ selection: PreviewSelection; showContext\?: boolean; ground\?: 'white' \| 'blue' \}\)/);
    assert.equal((CONTROL.match(/preview\.context/g) ?? []).length, 1);
    assert.match(FLAT, /\{showContext && <Text[^>]*>\{preview\.context\}<\/Text>\}/, 'the context line is drawn whether or not the host already says it');
  });

  test('it listens to nothing, records nothing and fetches nothing', () => {
    for (const reach of ['useAudioRecorder', 'RecordingPresets', 'AudioModule', 'scoreRecordedAttempt', 'fetch(', 'https://', "from '@luvani/brain'", 'expo-speech']) {
      assert.ok(!CONTROL.includes(reach), `the preview reaches for ${reach}`);
    }
    const model = stripComments(read('./preview.ts'));
    assert.match(model, /^import type \{ DailyScenario, Mission, TutorVoiceKey \} from '@luvani\/core';$/m);
    assert.doesNotMatch(model, /@luvani\/brain|fetch\(/);
  });

  test('it is quiet: no pill, no raw size, no faint words, and a toggle that says whether it is open', () => {
    assert.equal((CONTROL.match(/<PillButton\b/g) ?? []).length, 0, 'the preview draws a primary pill');
    assert.match(FLAT, /accessibilityState=\{\{ expanded: open \}\}/);
    for (const capped of ['fontSize', 'numberOfLines', 'maxFontSizeMultiplier', 'paper.inkFaint', '<ScrollView']) {
      assert.ok(!CONTROL.includes(capped), `the preview carries ${capped}`);
    }
    assert.doesNotMatch(CONTROL, /#[0-9a-fA-F]{3,8}\b|—/);
  });
});

describe('the chooser offers it on the one situation already picked out', () => {
  const SCREEN = stripComments(read('./MissionsScreen.tsx'));
  // 2026-09-27, notebook Phase 4 (B1): the card dropped the deprecated `tone="feature"`.
  const hero = SCREEN.slice(SCREEN.indexOf('<Card style={{ gap: space(3) }}>'), SCREEN.indexOf('</Card>', SCREEN.indexOf('<Card style={{ gap: space(3) }}>')));

  test('mounted inside the Start here card, after its one pill, for that mission', () => {
    assert.ok(hero.length > 0, 'the hero card moved; this test is stale');
    assert.match(hero, /<ListeningPreview selection=\{\{ kind: 'mission', mission: first\.mission \}\} \/>/);
    assert.match(SCREEN, /if \(focus && first\)/, 'the listening preview must belong to the selected scene brief');
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 1, 'the chooser grew a second primary pill');
  });
});

describe('both lesson doors that can open a live lesson say so', () => {
  test('the chooser’s two lesson controls carry the lesson-minutes line', () => {
    assert.equal(LESSON_DOOR.minutes, LESSON_MINUTES);
    const SCREEN = stripComments(read('./MissionsScreen.tsx'));
    const FLAT_SCREEN = SCREEN.replace(/\s+/g, ' ');
    // Beside the outline in the support card, and under the quiet typed door.
    const footer = SCREEN.slice(SCREEN.indexOf('<View style={st.footer}>'));
    assert.match(footer, /label=\{LESSON_DOOR\.title\}/);
    assert.match(footer, /\{LESSON_DOOR\.minutes\}/, 'the spoken lesson door hides its minutes');
    assert.match(footer, /accessibilityLabel=\{`\$\{LESSON_DOOR\.quiet\}\. \$\{LESSON_DOOR\.minutes\}`\}/, 'the typed lesson door hides that it can use live minutes');
    assert.ok(FLAT_SCREEN.includes('{LESSON_DOOR.minutes}'));
  });

  // Rewritten 2026-09-27 (notebook Phase 3, B1): Speak no longer draws its own
  // pronunciation row. The live lesson's doors are the chooser's two above, and
  // they still say it uses live minutes; the offline fallback is a bundled
  // local phrase whose route requires no service or minutes.
  test('Speak draws no second lesson door, and the offline local practice needs no minutes', () => {
    const tab = stripComments(read('../tabs/TutorTab.tsx')).replace(/\s+/g, ' ');
    assert.doesNotMatch(tab, /Practise pronunciation|LESSON_MINUTES/, 'Speak draws a lesson door the chooser already draws');
    assert.match(tab, /<LocalPracticeCard/);
    const local = stripComments(read('../practice/LocalPracticeCard.tsx'));
    assert.match(local, /localPracticeFor\(profile.tutorVoice, DAILY_ITEMS, TUTOR_DAILY_AUDIO\)/);
    assert.match(local, /navigate\('DailyPractice', \{ id: phrase.id, mode: 'shadowing' \}\)/);
  });
});
