/**
 * What Speak is allowed to decide, draw and leave out — F405, F573, and the
 * direction B rebuild.
 *
 * 2026-10-20, B2, B-Speak. Rewritten from the notebook Speak (tutor card, one
 * Start through NextTaskCard, the level path, "More ways to practise"). Speak
 * now draws, in the artboard's order: the header with its subtitle, the yellow
 * Recommended card with Speak/Type radios, the two preference chips, Prepare
 * first and the one Start; the starter scenes; "Same scene, a bit less help";
 * "Talk about anything"; the tutor card without its voice line; three tiles;
 * "Revisit a conversation"; and the speaking time as a band in words. Each old
 * pin below is rewritten to pin what replaced it, never dropped.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. The decisions are `tutor/speakTabView.ts`'s and are held in its own
 * suite.
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
const RENDER = SCREEN.slice(SCREEN.indexOf('\n  return (\n'));
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

describe('Speak follows B-Speak, in the artboard order (2026-10-20, B2, B-Speak)', () => {
  test('the sections stand in the artboard order', () => {
    const order = ['<TabHeader', '{RECOMMENDED}', '{scenes.heading}', '{LESS_HELP_TITLE}', '{TALK_TITLE}', '<TutorCard', 'tiles.map(', '{REVISIT.title}', '{minutesBand(planView)}'];
    const positions = order.map((marker) => at(marker));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'a section moved out of the artboard order');
  });

  test('the header says Speak and who it is with, on the shared frame with the avatar', () => {
    assert.match(RENDER_FLAT, /<TabHeader title=\{SPEAK_TITLE\} purpose=\{speakSubtitle\(tutorName\)\} trailing=\{<ProfileButton \/>\} \/>/);
  });

  // 2026-10-20, B2, B-Speak: replaces "the tutor card carries the voice from the catalogue".
  // The card keeps its name, sample and Change voice, and loses the sound line on Speak only.
  test('the tutor card carries its name, its sample and a way to change the voice, and no voice line', () => {
    assert.match(FLAT, /const card = tutorCardFacts\(voiceKey\)/, 'the card reads its words from somewhere other than speakView.ts');
    assert.match(FLAT, /const voiceKey = tutorVoiceOf\(profile\)/, 'the card is not the learner\'s chosen voice');
    const tutorCard = between(RENDER_FLAT, '<TutorCard', '/>', 'Speak draws the tutor card');
    for (const prop of ['name={card.name}', 'signature={card.signature}', 'onHear={hear}', 'playing={playing}', 'onChange={() => nav.navigate(CHANGE_VOICE_ROUTE.screen, CHANGE_VOICE_ROUTE.params)}']) {
      assert.ok(tutorCard.includes(prop), `the tutor card does not take ${prop}`);
    }
    assert.ok(!tutorCard.includes('voice={card.voice}'), 'Speak still draws the "A man\'s voice, from France" line');
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

  // 2026-10-20, B2, B-Speak: replaces "one Start ... with a quiet Type instead and no segmented pill".
  // The choice is the shared Choice radio over startModes, never a new segmented part.
  test('one Start on the Recommended card, with Speak and Type as radios defaulting to the standing choice', () => {
    assert.match(FLAT, /const modes = startModes\(prefersTyping\(profile\)\)/);
    assert.match(FLAT, /const textMode = chosenText \?\? modes\.textMode;/);
    const card = between(RENDER_FLAT, '<ColourCard ground="sun">', '</ColourCard>', 'Speak draws the yellow Recommended card');
    assert.match(card, /accessibilityRole="radiogroup"/);
    assert.match(card, /MODE_CHOICES\.map\(\(choice\) =>/);
    assert.match(card, /<Choice compact ground="card" role="radio" title=\{choice\.label\} selected=\{textMode === choice\.textMode\} onPress=\{\(\) => setChosenText\(choice\.textMode\)\} \/>/);
    assert.equal((card.match(/<PillButton label=\{START\}/g) ?? []).length, 1, 'the card carries other than one Start');
    assert.match(card, /onPress=\{\(\) => open\(textMode, next\.params\)\}/, 'Start does not open the next conversation through the probe');
    assert.doesNotMatch(SCREEN, /<TabBar\b|<SegmentedControl\b|Ready when you are/);
  });

  test('the Recommended card reads the scene, its minutes, the speaking time and the two preference chips', () => {
    assert.match(FLAT, /const rec = recommended\(next\);/);
    const card = between(RENDER_FLAT, '<ColourCard ground="sun">', '</ColourCard>', 'Speak draws the yellow Recommended card');
    assert.match(card, /\{rec\.title\}/);
    assert.match(card, /\{rec\.sentence\}/);
    assert.match(card, /rec\.minutes !== null && <Chip variant="meta" label=\{rec\.minutes\} \/>/);
    assert.match(card, /<Chip variant="meta" label=\{USES_SPEAKING_TIME\} \/>/);
    assert.match(card, /label=\{correctionsChip\(strictnessLabel\(profile\)\)\} onPress=\{\(\) => nav\.navigate\(PREFERENCES_ROUTE\.screen\)\}/);
    assert.match(card, /label=\{paceChip\(tutorName, paceOf\(profile\)\)\} onPress=\{\(\) => nav\.navigate\(PREFERENCES_ROUTE\.screen\)\}/);
    assert.match(card, /rec\.prepare !== null && <PillButton variant="secondary" label=\{PREPARE_FIRST\} onPress=\{\(\) => nav\.navigate\(rec\.prepare!\.screen, rec\.prepare!\.params\)\} \/>/);
  });

  // 2026-10-20, B2, B-Speak: replaces "the level path from the spine, then every scene as a ledger row".
  test('the starter scenes come from the path model, each opening its preview, with Every scene to the chooser', () => {
    assert.match(FLAT, /const scenes = starterScenes\(progress\);/);
    assert.match(RENDER_FLAT, /scenes\.rows\.map\(\(row\) =>/);
    assert.match(RENDER_FLAT, /<SceneMark state=\{row\.state\} \/>/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(row\.route\.screen, row\.route\.params\)\}/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(EVERY_SCENE\.route\.screen\)\}/);
    assert.match(RENDER_FLAT, /row\.next \? <Chip variant="meta" tone="lavender" label=\{NEXT_CHIP\} \/>/);
    assert.equal((SCREEN.match(/scenes\.rows\.map\(/g) ?? []).length, 1);
    assert.doesNotMatch(SCREEN, /<LevelPath|path.groups.map|<Highlight/);
    assert.ok(at('{RECOMMENDED}') < at('scenes.rows.map('));
  });

  test('the less-help card stands only for a real replay, opens through the probe, and locks only through the seam', () => {
    // 2026-10-20, lock seam wiring: the seam is the reactive hook's, a locked tap opens the Wall, and the badge is said once, in the card's label.
    assert.match(FLAT, /const locks = useFeatureAccess\(user\?\.id\);/);
    assert.match(FLAT, /const replay = lessHelp\(completions, locks\.access\);/);
    assert.match(RENDER_FLAT, /\{replay !== null && \(/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => tapThrough\(locks\.access, replay\.feature, locks\.open, \(\) => open\(textMode, replay\.params\)\)\}/);
    assert.match(RENDER_FLAT, /accessibilityLabel=\{`\$\{LESS_HELP_TITLE\}, \$\{replay\.title\}, \$\{replay\.line\}\$\{replay\.locked \? `, \$\{LOCK_BADGE_LABEL\}` : ''\}`\}/);
    assert.match(RENDER_FLAT, /\{replay\.locked && <LockBadge said \/>\}/);
    assert.doesNotMatch(SCREEN, /featureAccess\(/, 'the tab decides a lock itself instead of reading the view model');
  });

  test('Talk about anything offers the learner\'s own suggestions and their own topic, each through the probe', () => {
    assert.match(FLAT, /const talk = talkChips\(learningSuggestions\(practicePreferencesOf\(profile\)\)\);/);
    const card = between(RENDER_FLAT, '<ColourCard ground="blue">', '</ColourCard>', 'Speak draws the blue Talk about anything card');
    assert.match(card, /\{TALK_SUB\}/);
    assert.match(card, /ground=\{chip\.own \? 'violet2' : 'card'\}/);
    assert.match(card, /onPress=\{\(\) => open\(textMode, chip\.params\)\}/);
    assert.doesNotMatch(SCREEN, /My trip to Lyon|My weekend|Food I love/, 'Speak invents a personal topic');
  });

  test('three tiles, the conversations row and the minutes footer go where they say', () => {
    // 2026-10-20, lock seam wiring: tiles read the reactive seam; their routes are App.tsx's locked routes, so the tap needs no gate.
    assert.match(FLAT, /const tiles = speakTiles\(tutorName, locks\.access\);/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(tile\.route\.screen\)\}/);
    assert.match(RENDER_FLAT, /\{tile\.locked && <LockBadge form="round" said \/>\}/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(REVISIT\.route\.screen\)\}/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(SEE_MINUTES\.route\.screen\)\}/);
  });

  test('the speaking time is a band in words, never a count of seconds or a date', () => {
    assert.doesNotMatch(SCREEN, /secondsRemaining|allowanceSeconds|periodEnd/);
    assert.match(FLAT, /setPlanView\(planStatusFor\(status, Date\.now\(\)\)\)/);
    assert.match(RENDER_FLAT, /\{minutesBand\(planView\)\}/);
  });

  // 2026-10-20, B2, B-Speak: replaces "offline Speak says it is unavailable once"; the
  // bundled practice now sits inside the offline card, where NextTaskCard used to draw it.
  test('offline Speak says it is unavailable once and offers the bundled practice', () => {
    assert.match(FLAT, /const offlineShown = !live \|\| heldBack !== null/);
    assert.match(RENDER_FLAT, /\{offlineShown && \(/);
    assert.equal((RENDER.match(/TUTOR_OFFLINE.headline/g) ?? []).length, 1);
    const offline = between(RENDER_FLAT, '{offlineShown && (', '</Card>', 'the offline block is drawn');
    assert.match(offline, /\{primary\}/);
    assert.match(offline, /<LocalPracticeCard \/>/);
    assert.doesNotMatch(RENDER, /state-offline|todayItems/);
  });

  // 2026-10-20, B2, B-Speak: replaces '"More ways to practise" appears only after a first
  // finished scene'. Its three rows became the Talk about anything card (the open
  // conversation), Explore's Prepare for something real, and the memory tile.
  test('the old "More ways to practise" list is gone, and its rows have homes', () => {
    assert.doesNotMatch(SCREEN, /MORE_WAYS|moreWaysOpen/);
    assert.match(read('./ExploreTab.tsx'), /nav\.navigate\('RealMoment'/);
    assert.match(stripComments(read('../tutor/speakTabView.ts')), /screen: 'TutorMemory'/);
  });

  test('what left Speak stays gone', () => {
    for (const gone of [
      '<TintRow', 'DOORS', 'tutorDoors(', 'DOOR_TINT', '<VoiceOrb', 'settleIn', 'Animated', 'TUTOR_ORB_SIZE', 'Practise pronunciation',
      'MISSIONS.map(', 'scenarioCountLine', 'studio', 'Beginner', 'Veteran', 'streak', '<NextTaskCard', '<ContinuityCard', 'tutorHeading(',
    ]) {
      assert.ok(!SCREEN.includes(gone), `Speak still carries ${gone}`);
    }
    for (const literal of RENDER.match(/'[^']*'|"[^"]*"/g) ?? []) {
      if (literal.includes('/')) continue;
      assert.equal(guiltIn(literal), undefined, `Speak spells ${literal}`);
      assert.doesNotMatch(literal, /—|·/);
    }
    assert.match(RENDER, /\{MICROPHONE_NOTICE\}/);
  });
});

describe('Speak keeps its history read, its plan read and its continuation', () => {
  test('unread history is a retry state, owned by the account that asked', () => {
    assert.match(FLAT, /setHistoryStatus\('loading'\)/);
    assert.match(FLAT, /setHistoryStatus\('unread'\)/);
    assert.match(FLAT, /setHistoryReadOwner\(scope\); setHistoryReadyOwner\(null\); setHistoryStatus\('loading'\)/);
    assert.match(FLAT, /setHistoryReadyOwner\(scope\); setHistoryStatus\('ready'\)/);
    assert.match(FLAT, /const renderHistoryStatus = ownedReadStatus\(historyStatus, historyReadOwner, historyReadyOwner, currentScope\)/);
    assert.match(FLAT, /if \(renderHistoryStatus !== 'ready'\) return <ScrollScreen/);
    assert.match(FLAT, /Try loading conversations again/);
  });

  // 2026-10-20, B2, B-Speak: replaces "what the tutor remembers is drawn from a real record
  // only, and a thread reaches the room it opens". The ContinuityCard left Speak; a thread
  // is the Recommended card's own conversation, and nextConversation carries its pack.
  test('a thread to pick up is the Recommended conversation, gated by the plan', () => {
    assert.match(FLAT, /threadFrom\(\{ records: scenes, progress, packs, marks, topics \}\)/);
    assert.match(FLAT, /const next = nextConversation\(progress, thread, capabilitiesFor\(plan\.tier, plan\.lapsed\)\.continueArc\);/);
    assert.match(stripComments(read('../tutor/nextConversation.ts')), /params: \{ seedTopic: thread\.seedTopic, continuationPackId: thread\.packId \}/);
    const navigator = stripComments(read('../nav/RootNavigator.tsx')).replace(/\s+/g, ' ');
    assert.match(navigator, /continuationPackId=\{route\.params\?\.continuationPackId\}/);
  });

  test('a probe that threw lets go of the checking flag instead of retiring the tab', () => {
    const opener = between(FLAT, 'const open = (', 'useFocusEffect(', 'the tab has an opener for the conversation');
    assert.match(opener, /if \(checking\) return;/);
    assert.match(opener, /\.catch\(/);
    assert.ok(opener.indexOf('.then(') < opener.indexOf('.catch('));
    assert.doesNotMatch(opener, /\}, \(\) => \{/);
    assert.equal((opener.match(/setChecking\(false\)/g) ?? []).length, 2);
    assert.match(opener, /setHeldBack\(\{ textMode \}\)/);
    assert.match(RENDER_FLAT, /\{checking && <Text accessibilityLiveRegion="polite"[^>]*>\{TUTOR_OFFLINE\.checking\}<\/Text>\}/);
  });

  test('a disk that will not answer takes nothing off the tab', () => {
    const effect = between(FLAT, 'useFocusEffect(', 'const open = (', 'the tab reads its storage on focus');
    assert.match(effect, /\.catch\(/);
    assert.ok(effect.indexOf('.then(') < effect.indexOf('.catch('));
    const rescue = effect.slice(effect.indexOf('.catch('));
    assert.ok(!rescue.includes('setThread('));
    assert.ok(!rescue.includes('setCompletions('));
    assert.ok(!rescue.includes('setProgress('), 'a failed read resets the path to day one');
  });

  test('a refused start is forgotten once the tutor is reachable again, and a retry is the same start', () => {
    assert.match(FLAT, /useEffect\(\(\) => \{ if \(live\) setHeldBack\(null\); \}, \[live\]\);/);
    const offline = between(RENDER, '{offlineShown && (', '</Card>', 'the offline block is drawn');
    assert.ok(!offline.includes('LESSON_MINUTES'));
    assert.match(FLAT, /open\(heldBack\?\.textMode \?\? textMode, heldBack \? pendingStart\.current : next\.params\)/);
    assert.match(FLAT, /const orb = tutorOrbState\(\{ live, checking, canStart \}\)/);
    assert.match(FLAT, /const note = startNote\(orb, offlineShown\);/);
  });
});
