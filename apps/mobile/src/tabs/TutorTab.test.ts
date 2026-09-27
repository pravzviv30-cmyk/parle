/**
 * What Speak is allowed to decide, draw and leave out — F405, F573, and the
 * notebook redesign.
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1). Speak leads with the tutor card
 * (the name and sound line from TUTOR_VOICES, the voice sample's French line as
 * the signature, a play control and a link to change the voice), then the one
 * Start with a quiet "Type instead" under it, then the A0 to A1 level path from
 * the spine with "you are here" on the next scene, then every scene as a ledger
 * row that opens its brief in the chooser. "More ways to practise" appears only
 * after a first finished scene. The Speak/Type segmented pill, the moving
 * circle, the tinted door rows and "Ready when you are" are gone.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. The words are `tutor/speakView.ts`'s and are held in its own suite.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { guiltIn } from '../copy/guilt.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./TutorTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));
const RENDER_FLAT = RENDER.replace(/\s+/g, ' ');

function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

describe('Speak leads with the tutor, then one Start, then the path', () => {
  test('the tutor card carries the voice from the catalogue, its sample, and a way to change it', () => {
    assert.match(FLAT, /const card = tutorCardFacts\(voiceKey\)/, 'the card reads its words from somewhere other than speakView.ts');
    assert.match(FLAT, /const voiceKey = tutorVoiceOf\(profile\)/, 'the card is not the learner\'s chosen voice');
    const tutorCard = between(RENDER_FLAT, '<TutorCard', '/>', 'Speak draws the tutor card');
    for (const prop of ['name={card.name}', 'voice={card.voice}', 'signature={card.signature}', 'onHear={hear}', 'playing={playing}', "onChange={() => nav.navigate('Profile', { sheet: 'tutorVoice' })}"]) {
      assert.ok(tutorCard.includes(prop), `the tutor card does not take ${prop}`);
    }
    // The sample is the bundled clip, one player, and it stops when the tab is left.
    assert.match(FLAT, /player\.replace\(voiceSample\(voiceKey\)\)/, 'the sample is not the bundled clip for this voice');
    assert.match(FLAT, /if \(!focused\) \{ player\.pause\(\); setPlaying\(false\); \}/, 'the sample keeps playing behind another tab');
    assert.match(FLAT, /if \(status\.didJustFinish\) setPlaying\(false\)/, 'a finished sample leaves the control saying Stop');
    assert.match(FLAT, /const focused = useIsFocused\(\);/);
  });

  test('Change voice opens the Profile voice sheet directly and consumes the route request', () => {
    const profile = stripComments(read('./ProfileTab.tsx')).replace(/\s+/g, ' ');
    const routes = stripComments(read('../nav/types.ts'));
    assert.match(routes, /Profile: \{ sheet\?: 'tutorVoice' \} \| undefined/);
    assert.match(profile, /useRoute<RouteProp<RootStackParamList, 'Profile'>>\(\)/);
    assert.match(profile, /useState<Sheet>\(route\.params\?\.sheet === 'tutorVoice' \? 'tutorVoice' : 'none'\)/);
    assert.match(profile, /if \(route\.params\?\.sheet !== 'tutorVoice'\) return; setSheet\(route\.params\.sheet\); nav\.setParams\(\{ sheet: undefined \}\);/);
    assert.match(profile, /\[nav, route\.params\?\.sheet\]/);
    assert.match(profile, /samplePlayer\.pause\(\); setSamplePlaying\(null\); setSheet\('none'\);/);
  });

  test('one Start, the next conversation, with a quiet "Type instead" under it and no segmented pill', () => {
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 1, 'Speak has more or less than one primary');
    const pill = between(FLAT, '<PillButton', '/>', 'Speak keeps one launch pill');
    // 2026-09-27 follow-up: the Start opens in the learner's standing mode
    // (Profile's "Prefer typing"), and the quiet link offers the other one.
    assert.match(FLAT, /const modes = startModes\(prefersTyping\(profile\)\)/, 'Speak ignores the learner\'s standing choice to type');
    assert.match(pill, /label=\{launchLabel\(\{ checking, live, mode: modes\.mode \}\)\}/, 'the Start does not name the preferred mode');
    assert.match(pill, /onPress=\{\(\) => open\(modes\.textMode, next\.params\)\}/);
    assert.match(pill, /disabled=\{checking\}/);
    assert.match(pill, /accessibilityLabel=\{launchAccessibilityLabel\(\{ checking, live, mode: modes\.mode, tutorName \}\)\}/);
    assert.match(RENDER_FLAT, /<GhostButton label=\{modes\.other\.label\} color=\{paper\.ink\} disabled=\{checking\} onPress=\{\(\) => open\(modes\.other\.textMode, next\.params\)\} \/>/, 'the quiet link does not open the same conversation the other way');
    assert.ok(at('<PillButton') < at('label={modes.other.label}'), 'the quiet link is not under Start');
    assert.ok(!/<TabBar\b/.test(SCREEN), 'the Speak/Type segmented pill is back');
    assert.ok(!SCREEN.includes("mode === 'type'"), 'Speak still carries a mode toggle');
    // The next conversation says its level, minutes and lines, never "Ready when you are".
    assert.match(RENDER, /\{next\.detail\}/);
    assert.match(RENDER, /next\.lines\.map\(/);
    assert.match(FLAT, /<Text style=\{st\.notice\}>\{launchNotice\(modes\.mode\)\}<\/Text>/);
    assert.ok(!SCREEN.includes('Ready when you are'));
  });

  test('the level path from the spine, then every scene as a ledger row that opens its brief', () => {
    // 2026-09-27, notebook Phase 4 (B1): the Phase 3 browser proof found the
    // path drawn twice, the level path's can-do stops and then the same lines
    // as rows. It is one list now: rows grouped by level, each with its minutes,
    // the "here" row carrying the highlighter, and each opening its brief.
    assert.match(FLAT, /const path = speakPath\(progress\)/, 'the path is not the spine projection');
    assert.ok(!SCREEN.includes('<LevelPath'), 'Speak draws the path twice again');
    assert.ok(!SCREEN.includes('path.levels'), 'Speak reads a second list of the same scenes');
    assert.match(RENDER_FLAT, /path\.groups\.map\(\(group\) => \(/);
    const group = between(RENDER_FLAT, 'path.groups.map((group) => (', '))}', 'the path is drawn by level');
    assert.match(group, /<Label>\{group\.level\}<\/Label>/, 'a group of scenes does not say its level');
    // To the row's own close, past the highlighter's `/>` inside its trailing slot.
    const row = between(RENDER_FLAT, '<LedgerRow key={row.missionId}', 'row.route.params)} />', 'each scene is a ledger row');
    for (const prop of [
      'label={row.label}',
      'title={row.title}',
      'gloss={row.gloss}',
      'meta={row.meta}',
      'accessibilityLabel={row.accessibilityLabel}',
      'onPress={() => nav.navigate(row.route.screen, ',
      'disabled={checking}',
    ]) {
      assert.ok(row.includes(prop), `a scene row does not take ${prop}`);
    }
    // The highlighter is the "here" row's, and nothing else on Speak draws one.
    assert.match(row, /trailing=\{row\.state === 'here' \? <Highlight text=\{HERE_MARK\}/, 'the "here" row does not carry the highlighter');
    assert.equal((SCREEN.match(/<Highlight\b/g) ?? []).length, 1, 'Speak draws more or less than one highlighter');
    assert.ok(!SCREEN.includes('accent.feature'), 'Speak paints chartreuse outside the path');
    // Order: the tutor, the Start, the rows.
    assert.ok(at('<TabHeader') < at('<TutorCard'));
    assert.ok(at('<TutorCard') < at('<PillButton'));
    assert.ok(at('<PillButton') < at('<LedgerRow key={row.missionId}'));
  });

  test('offline Speak says it is unavailable once', () => {
    // 2026-09-27, notebook Phase 4 (B1): the line under the Start said the tutor
    // was away while the offline card under it said it could not connect.
    // `startNote` stands the line down while the card is up.
    assert.match(FLAT, /const offlineShown = !live \|\| heldBack !== null;/);
    assert.match(FLAT, /const note = startNote\(orb, offlineShown\);/);
    assert.match(RENDER_FLAT, /\{note !== null && <Text style=\{st\.notice\}>\{note\}<\/Text>\}/);
    assert.match(RENDER_FLAT, /\{offlineShown && \(/, 'the offline card is drawn on a different condition from the one the line stands down for');
    assert.ok(!RENDER.includes('orb.subline'), 'the line under the Start is drawn without asking whether the card already says it');
  });

  test('"More ways to practise" appears only after a first finished scene', () => {
    assert.match(RENDER, /\{moreWaysOpen\(progress\) && \(/, 'more ways are offered before a first scene');
    assert.match(RENDER, /\{MORE_WAYS_LABEL\}/);
    assert.match(RENDER_FLAT, /MORE_WAYS\.map\(\(way\) => \(/);
    assert.ok(at('<LedgerRow key={row.missionId}') < at('MORE_WAYS.map('), 'more ways come before the path');
    const handler = between(FLAT, 'const more = (', '};', 'Speak opens a way in');
    assert.match(handler, /if \(way\.screen === null\) \{ open\(modes\.textMode\); return; \}/, 'the open conversation does not probe the tutor in the preferred mode');
    assert.match(handler, /nav\.navigate\(way\.screen\)/);
  });

  test('what left Speak stays gone', () => {
    for (const gone of [
      '<TintRow', 'DOORS', 'tutorDoors(', 'DOOR_TINT', '<VoiceOrb', 'settleIn', 'Animated', 'TUTOR_ORB_SIZE', 'Practise pronunciation',
      'MISSIONS.map(', 'scenarioCountLine', 'studio', 'Beginner', 'Veteran', 'streak',
    ]) {
      assert.ok(!SCREEN.includes(gone), `Speak still carries ${gone}`);
    }
    // Every numeral-free, guilt-free literal the tab spells itself.
    for (const literal of RENDER.match(/'[^']*'|"[^"]*"/g) ?? []) {
      if (literal.includes('/')) continue;
      assert.equal(guiltIn(literal), undefined, `Speak spells ${literal}`);
      assert.doesNotMatch(literal, /—/);
    }
    assert.match(FLAT, /MICROPHONE_NOTICE/);
    assert.match(RENDER, /\{MICROPHONE_NOTICE\}/);
  });
});

describe('Speak keeps its memory, its plan read and its continuation', () => {
  test('what the tutor remembers is drawn from a real record only, and a thread reaches the room it opens', () => {
    assert.match(RENDER, /\{continuity !== null && \(/);
    assert.match(RENDER, /<ContinuityCard/);
    assert.match(FLAT, /continuityFrom\(\{ brain: profile\.brain, packs, records: scenes, progress \}\)/);
    assert.match(FLAT, /headline=\{continuityHeadline\(tutorName\)\}/);
    assert.doesNotMatch(FLAT, /markPackContinued/);
    assert.match(FLAT, /nav\.navigate\(route\.screen, \{ \.\.\.route\.params, continuationPackId: route\.markPack, textMode: false \}\)/);
    assert.match(FLAT, /nav\.navigate\(route\.screen, route\.screen === 'Convo' \? \{ \.\.\.route\.params, textMode: false \} : route\.params\)/);
    assert.match(FLAT, /capabilitiesFor\(plan\.tier, plan\.lapsed\)\.continueArc/);

    const convo = stripComments(read('../ConvoScreen.tsx')).replace(/\s+/g, ' ');
    const navigator = stripComments(read('../nav/RootNavigator.tsx')).replace(/\s+/g, ' ');
    assert.match(navigator, /continuationPackId=\{route\.params\?\.continuationPackId\}/);
    assert.match(convo, /continuationPackId === undefined \|\| live\.convo === null\) return;/);
  });

  test('a probe that threw lets go of the checking flag instead of retiring the tab', () => {
    const opener = between(FLAT, 'const open = (', 'useFocusEffect(', 'the tab has an opener for the conversation');
    assert.match(opener, /if \(checking\) return;/);
    assert.match(opener, /\.catch\(/);
    assert.ok(opener.indexOf('.then(') < opener.indexOf('.catch('));
    assert.doesNotMatch(opener, /\}, \(\) => \{/);
    assert.equal((opener.match(/setChecking\(false\)/g) ?? []).length, 2);
    assert.match(opener, /setHeldBack\(\{ textMode \}\)/);
    assert.match(RENDER, /\{checking && <Text accessibilityLiveRegion="polite" style=\{st\.checking\}>\{TUTOR_OFFLINE\.checking\}<\/Text>\}/);
  });

  test('a disk that will not answer takes the memory row and nothing else off the tab', () => {
    const effect = between(FLAT, 'useFocusEffect(', 'const open = (', 'the tab reads its storage on focus');
    assert.match(effect, /\.catch\(/);
    assert.ok(effect.indexOf('.then(') < effect.indexOf('.catch('));
    const rescue = effect.slice(effect.indexOf('.catch('));
    assert.ok(!rescue.includes('setContinuity('));
    assert.ok(!rescue.includes('setThread('));
    assert.ok(!rescue.includes('setProgress('), 'a failed read resets the path to day one');
  });

  test('a refused start is forgotten once the tutor is reachable again', () => {
    assert.match(FLAT, /useEffect\(\(\) => \{ if \(live\) setHeldBack\(null\); \}, \[live\]\);/);
    const offline = between(RENDER, '{offlineShown && (', '</Card>', 'the offline block is drawn');
    assert.ok(!offline.includes('LESSON_MINUTES'));
    // The circle's state words survive as a line under the Start when it is not
    // ready, unless the offline card already says the same thing.
    assert.match(FLAT, /const orb = tutorOrbState\(\{ live, checking, canStart \}\)/);
    assert.match(FLAT, /const note = startNote\(orb, offlineShown\);/);
  });
});
