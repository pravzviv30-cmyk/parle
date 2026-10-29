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
 *
 * 2026-10-20 UI-008, artboard B-Speak: rebuilt to the artboard in light and
 * dark. The old shared parts (TutorCard, ColourCard, Choice, Chip, Ledger,
 * PillButton, SceneMark) gave way to the artboard's own: the yellow hero with
 * its Speak/Type control and outline chips, the BButton Prepare first and
 * Start, the tiled scene list, the dashed twist card, the 40pt topic chips,
 * the tutor row with the orb and lavender speaker, the drawn tiles. Revisit a
 * conversation and the microphone notice left (the artboard draws neither).
 * Each pin below is rewritten to what replaced it.
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
    // 2026-10-20 UI-008, artboard B-Speak: the tutor row is the orb row, and the revisit row left.
    const order = ['<TabHeader', '{rec.eyebrow}', '{scenes.heading}', '{LESS_HELP_TITLE}', '{TALK_TITLE}', '<BArt name="tutor-orb"', 'tiles.map(', '{minutesBand(planView)}'];
    const positions = order.map((marker) => at(marker));
    assert.deepEqual([...positions].sort((a, b) => a - b), positions, 'a section moved out of the artboard order');
  });

  test('the header says Speak and who it is with, on the shared frame with the avatar', () => {
    assert.match(RENDER_FLAT, /<TabHeader title=\{SPEAK_TITLE\} purpose=\{speakSubtitle\(tutorName\)\} trailing=\{<ProfileButton \/>\} \/>/);
  });

  // 2026-10-20, B2, B-Speak: replaces "the tutor card carries the voice from the catalogue".
  // 2026-10-20 UI-008, artboard B-Speak: the row is the orb, the name, Change voice and
  // the lavender speaker; the signature shows only while the sample is heard.
  test('the tutor row carries its name, its sample and a way to change the voice, and no voice line', () => {
    assert.match(FLAT, /const card = tutorCardFacts\(voiceKey\)/, 'the card reads its words from somewhere other than speakView.ts');
    assert.match(FLAT, /const voiceKey = tutorVoiceOf\(profile\)/, 'the card is not the learner\'s chosen voice');
    const row = between(RENDER_FLAT, '<View style={st.tutor}>', '<View style={[st.tiles', 'Speak draws the tutor row');
    assert.match(row, /<BArt name="tutor-orb" width=\{56\} height=\{56\} \/>/);
    assert.match(row, /\{card\.name\}/);
    assert.match(row, /<TextLink label=\{CHANGE_VOICE\} text=\{bType\.bold14\} onPress=\{\(\) => nav\.navigate\(CHANGE_VOICE_ROUTE\.screen, CHANGE_VOICE_ROUTE\.params\)\} \/>/);
    assert.match(row, /onPress=\{hear\}/);
    assert.match(row, /accessibilityLabel=\{playing \? `Stop \$\{card\.name\}` : `Hear \$\{card\.name\}`\}/);
    assert.match(row, /<BSpeaker size=\{22\} color=\{t\.text\} \/>/);
    assert.match(FLAT, /const caption = sampleCaption\(playing, card\.signature\);/, 'the sample is heard and never readable');
    assert.match(row, /\{caption !== null && <Text \{\.\.\.frenchText\}/);
    assert.ok(!row.includes('card.voice'), 'Speak still draws the "A man\'s voice, from France" line');
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
  // 2026-10-20 UI-008, artboard B-Speak: the choice is the artboard's Speak/Type control on
  // the butter track, two radio cells over startModes, the chosen one with a tick.
  test('one Start on the Recommended card, with Speak and Type as radios defaulting to the standing choice', () => {
    assert.match(FLAT, /const modes = startModes\(prefersTyping\(profile\)\)/);
    // Beta: a third radio, Listen only. The default is still the standing
    // choice, Speak or Type, never Listen.
    assert.match(FLAT, /const answer = modeChoice\(chosenMode \?\? modes\.mode\);/);
    assert.match(FLAT, /const textMode = answer\.textMode;/);
    const card = between(RENDER_FLAT, '<View style={st.hero} onLayout=', '{WALK_AVAILABLE', 'Speak draws the yellow Recommended card');
    assert.match(card, /accessibilityRole="radiogroup" accessibilityLabel="How you answer"/);
    assert.match(card, /\{answer\.helper\(tutorName\)\}/, 'the chosen mode says what it means under the radios');
    assert.match(card, /MODE_CHOICES\.map\(\(choice\) =>/);
    assert.match(card, /<Segment key=\{choice\.key\} label=\{choice\.label\} selected=\{answer\.key === choice\.key\} onPress=\{\(\) => setChosenMode\(choice\.key\)\} \/>/);
    const segment = between(FLAT, 'function Segment(', 'function OutlineChip(', 'the Speak/Type cell is drawn here');
    assert.match(segment, /accessibilityRole="radio" accessibilityLabel=\{label\} accessibilityState=\{\{ checked: selected, selected \}\}/);
    assert.match(segment, /aria-checked=\{selected\}/, 'the web reads no checked state off the Speak, Listen or Type radio');
    assert.match(segment, /\{selected && <Tick color=\{t\.heroText\} \/>\}/, 'the chosen cell is told by its fill alone');
    assert.match(segment, /selected && \{ backgroundColor: t\.heroChip \}/);
    assert.equal((card.match(/<BButton label=\{START\}/g) ?? []).length, 1, 'the card carries other than one Start');
    assert.match(card, /height=\{54\} ground=\{t\.heroCta\} ink=\{t\.heroCtaText\}/);
    // The Start's glyph follows the chosen mode: mic, headphones or keyboard.
    assert.match(card, /<StartGlyph icon=\{answer\.icon\} color=\{t\.heroCtaText\} \/>/);
    const glyph = between(FLAT, 'function StartGlyph(', 'function Segment(', 'the Start glyph is drawn here');
    assert.match(glyph, /<KeyboardMark size=\{20\}/);
    assert.match(glyph, /<Icon name="headphones" size=\{20\}/);
    assert.match(glyph, /<BMic size=\{20\}/);
    assert.match(card, /onPress=\{\(\) => open\(textMode, answered\(next\.params\)\)\}/, 'Start does not open the next conversation through the probe, in the chosen mode');
    assert.match(FLAT, /const answered = \(params: object\): object => withAnswerMode\(answer\.key, params\);/);
    // The held-back retry keeps the params it was refused with, Listen only included.
    assert.match(FLAT, /heldBack \? pendingStart\.current : answered\(next\.params\)/);
    assert.doesNotMatch(SCREEN, /<TabBar\b|<SegmentedControl\b|Ready when you are/);
  });

  test('the Recommended card reads the scene, its minutes, the speaking time and the two preference chips', () => {
    assert.match(FLAT, /const rec = recommended\(next\);/);
    const card = between(RENDER_FLAT, '<View style={st.hero} onLayout=', '{WALK_AVAILABLE', 'Speak draws the yellow Recommended card');
    assert.match(card, /<BArt name="cafe-table" width=\{150\} height=\{137\} style=\{st\.heroArt\} \/>/);
    // F920: on a phone or at large text the café sits in a band above the words, which run full width.
    assert.match(card, /<BArt name="cafe-table" width=\{heroFrame\.band!\.width\} height=\{heroFrame\.band!\.height\} style=\{st\.heroBand\} \/>/);
    assert.match(card, /heroSide && st\.heroTitle/);
    assert.match(card, /\{rec\.title\}/);
    assert.match(card, /\{rec\.sentence\}/);
    assert.match(card, /rec\.minutes !== null && <HeroPill label=\{rec\.minutes\} \/>/);
    assert.match(card, /<HeroPill label=\{USES_SPEAKING_TIME\} \/>/);
    assert.match(card, /<OutlineChip label=\{correctionsChip\(strictnessLabel\(profile\)\)\} onPress=\{\(\) => nav\.navigate\(PREFERENCES_ROUTE\.screen\)\} \/>/);
    assert.match(card, /<OutlineChip label=\{paceChip\(tutorName, paceOf\(profile\)\)\} onPress=\{\(\) => nav\.navigate\(PREFERENCES_ROUTE\.screen\)\} \/>/);
    assert.match(card, /rec\.prepare !== null && \(/);
    assert.match(card, /<BButton label=\{PREPARE_FIRST\} height=\{48\} ground=\{t\.heroChip\} ink=\{t\.heroText\} text=\{bType\.bold16\} onPress=\{\(\) => nav\.navigate\(rec\.prepare!\.screen, rec\.prepare!\.params\)\} \/>/);
    const style = between(FLAT, 'hero: {', '},', 'the hero has a style');
    for (const part of ['backgroundColor: t.heroGround', 'borderRadius: 28', 'padding: 20', 'gap: 6']) assert.ok(style.includes(part), `the hero lost ${part}`);
    assert.match(FLAT, /segment: \{ marginTop: 10, flexDirection: 'row', gap: 4, padding: 4, borderRadius: 24, backgroundColor: t\.butter \}/);
    // 2026-10-20 UI-008, sim check: the chips are the artboard's exact 36 / 0 12 / 13/600, hugging their words.
    assert.match(FLAT, /outline: \{ minHeight: 36, borderRadius: 18, borderWidth: 1\.5, paddingHorizontal: 12, paddingVertical: 0,/);
    assert.match(FLAT, /<Text style=\{\[bType\.semi13, \{ color: t\.heroText \}\]\}>\{label\}<\/Text>/);
    assert.match(FLAT, /frame=\{st\.hug\} style=\{\[st\.outline/);
  });

  // 2026-10-20, B2, B-Speak: replaces "the level path from the spine, then every scene as a ledger row".
  // 2026-10-20 UI-008, artboard B-Speak: the rows are the artboard's tiled list: the state's
  // tile with the place icon, the French title, its line, and the check, Next pill or chevron.
  test('the starter scenes come from the path model, each opening its preview, with Every scene to the chooser', () => {
    assert.match(FLAT, /const scenes = starterScenes\(progress\);/);
    assert.match(RENDER_FLAT, /scenes\.rows\.map\(\(row, i\) =>/);
    assert.match(RENDER_FLAT, /backgroundColor: t\[row\.tile\.ground\]/);
    assert.match(RENDER_FLAT, /<BArt name=\{row\.icon\.name\} width=\{row\.icon\.width\} height=\{row\.icon\.height\} \/>/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(row\.route\.screen, row\.route\.params\)\}/);
    assert.match(RENDER_FLAT, /<TextLink label=\{EVERY_SCENE\.label\} text=\{bType\.bold15\} onPress=\{\(\) => nav\.navigate\(EVERY_SCENE\.route\.screen\)\} \/>/);
    assert.match(RENDER_FLAT, /row\.tile\.trailing === 'check' \? <CheckDisc size=\{24\} fill=\{t\.mint\} tick=\{t\.onMint\} \/>/);
    assert.match(RENDER_FLAT, /row\.tile\.trailing === 'next' \? <View style=\{st\.nextPill\}><Text style=\{\[type\.badge, \{ color: t\.onBrand \}\]\}>\{NEXT_CHIP\}<\/Text><\/View>/);
    assert.equal((SCREEN.match(/scenes\.rows\.map\(/g) ?? []).length, 1);
    assert.doesNotMatch(SCREEN, /<LevelPath|path.groups.map|<Highlight|<SceneMark|<LedgerRow/);
    assert.ok(at('{rec.eyebrow}') < at('scenes.rows.map('));
  });

  test('the less-help card stands only for a real replay, opens through the probe, and locks only through the seam', () => {
    // 2026-10-20, lock seam wiring: the seam is the reactive hook's, a locked tap opens the Wall, and the badge is said once, in the card's label.
    assert.match(FLAT, /const locks = useFeatureAccess\(user\?\.id\);/);
    assert.match(FLAT, /const replay = lessHelp\(completions, locks\.access\);/);
    assert.match(RENDER_FLAT, /\{replay !== null && \(/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => tapThrough\(locks\.access, replay\.feature, locks\.open, \(\) => open\(textMode, answered\(replay\.params\)\)\)\}/);
    // 2026-10-20 UI-008, artboard B-Speak: the drawn line is the artboard's; the help word is said in the label.
    assert.match(RENDER_FLAT, /accessibilityLabel=\{lockSaid\(`\$\{LESS_HELP_TITLE\}, \$\{replay\.title\}, \$\{replay\.line\}, \$\{replay\.help\}`, replay\.feature, replay\.locked\)\}/);
    assert.match(RENDER_FLAT, /<BArt name="cafe-table" width=\{70\} height=\{64\} style=\{st\.twistArt\} \/>/);
    assert.match(FLAT, /borderWidth: 2, borderStyle: 'dashed', borderColor: t\.periwinkle/);
    assert.match(RENDER_FLAT, /\{replay\.locked && <LockBadge feature=\{replay\.feature\} said \/>\}/);
    assert.doesNotMatch(SCREEN, /featureAccess\(/, 'the tab decides a lock itself instead of reading the view model');
  });

  test('Talk about anything offers the learner\'s own suggestions and their own topic, each through the probe', () => {
    // 2026-10-20 UI-008, founder decision: remembered interests and life events first (forgotten gone, none while paused).
    assert.match(FLAT, /const talk = talkChips\(learningSuggestions\(practicePreferencesOf\(profile\)\), \{ facts: visibleFacts\(profile\), paused: memoryPaused\(profile\.brain\) \}\);/);
    const card = between(RENDER_FLAT, '<View style={st.talk}>', '<View style={st.tutor}>', 'Speak draws the blue Talk about anything card');
    assert.match(card, /\{TALK_SUB\}/);
    assert.match(card, /backgroundColor: chip\.own \? t\.violet2 : t\.card/);
    assert.match(card, /hitSlop=\{CHIP_SLOP\}/, 'a 40pt chip has no way to the touch floor');
    assert.match(card, /onPress=\{\(\) => open\(textMode, answered\(chip\.params\)\)\}/);
    assert.doesNotMatch(SCREEN, /My trip to Lyon|My weekend|Food I love/, 'Speak invents a personal topic');
  });

  // 2026-10-20 UI-008, artboard B-Speak: replaces "three tiles, the conversations row and the minutes footer".
  test('three drawn tiles and the minutes footer go where they say, and the revisit row left', () => {
    // 2026-10-20, lock seam wiring: tiles read the reactive seam; their routes are App.tsx's locked routes, so the tap needs no gate.
    assert.match(FLAT, /const tiles = speakTiles\(tutorName, locks\.access\);/);
    assert.match(RENDER_FLAT, /onPress=\{\(\) => nav\.navigate\(tile\.route\.screen\)\}/);
    assert.match(RENDER_FLAT, /\{tile\.locked && tile\.feature !== null && <LockBadge feature=\{tile\.feature\} form="round" said \/>\}/);
    assert.match(RENDER_FLAT, /<BArt name=\{tile\.art\.name\} width=\{tile\.art\.width\} height=\{tile\.art\.height\} \/>/);
    assert.match(RENDER_FLAT, /backgroundColor: t\[tile\.ground\]/);
    // 2026-10-20 UI-008, sim check: the padding is tileLayout's (12, or 10 to keep three up).
    assert.match(FLAT, /tile: \{ flex: 1, minWidth: 0, minHeight: 120, borderRadius: 20, gap: 6 \}/);
    assert.match(RENDER_FLAT, /backgroundColor: t\[tile\.ground\], padding: tilePad/);
    // 2026-10-20 UI-008, sim check: the band line and the link are one centred column.
    assert.match(FLAT, /footer: \{ alignItems: 'center', gap: 2 \}/);
    assert.match(FLAT, /style=\{\[st\.link, centred && st\.linkCentred\]\}/);
    assert.match(FLAT, /linkCentred: \{ alignSelf: 'center' \}/);
    assert.match(RENDER_FLAT, /<TextLink centred label=\{SEE_MINUTES\.label\} text=\{bType\.bold14\} onPress=\{\(\) => nav\.navigate\(SEE_MINUTES\.route\.screen\)\} \/>/);
    assert.doesNotMatch(SCREEN, /REVISIT/, 'the revisit row the artboard does not draw is back');
    // 2026-10-20, sim nits: the tile row's columns come from tileColumns, so no title breaks mid-word.
    assert.match(FLAT, /const \{ columns, padding: tilePad \} = tileLayout\(\{ contentWidth: width - space\(10\), fontScale, titleSize: bType\.bold14\.fontSize,/);
    assert.match(RENDER_FLAT, /<View style=\{\[st\.tiles, columns === 1 && st\.column\]\}>/);
    assert.match(RENDER_FLAT, /frame=\{columns === 2 \? st\.half : columns === 3 \? st\.third : undefined\}/);
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
    // 2026-10-21 UI-008, B-Empty-States "Tutor away or offline": the block is the lavender away card.
    const offline = between(RENDER_FLAT, '{offlineShown && (', '</EmptyStateCard>', 'the offline block is drawn');
    assert.match(offline, /\{primary\}/);
    assert.match(offline, /<LocalPracticeCard \/>/);
    assert.match(offline, /title=\{TUTOR_OFFLINE\.headline\} body=\{TUTOR_OFFLINE\.body\}/);
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
    // 2026-10-20 UI-008, artboard B-Speak: the microphone notice left Speak (the artboard
    // draws none); the chooser keeps it for a first run, and the room asks only on a tap.
    assert.doesNotMatch(SCREEN, /MICROPHONE_NOTICE/);
    assert.match(stripComments(read('../missions/chooserView.ts')), /microphoneNotice: input\.spokenBefore \? null : MICROPHONE_NOTICE/);
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
    assert.match(FLAT, /const next = nextConversation\(progress, thread, capabilitiesFor\(plan\.tier, plan\.lapsed\)\.continueArc, goalOf\(profile\), startAtOf\(profile\)\);/);
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
    const offline = between(RENDER, '{offlineShown && (', '</EmptyStateCard>', 'the offline block is drawn');
    assert.ok(!offline.includes('LESSON_MINUTES'));
    assert.match(FLAT, /open\(heldBack \? heldBack\.textMode : textMode, heldBack \? pendingStart\.current : answered\(next\.params\)\)/);
    assert.match(FLAT, /const orb = tutorOrbState\(\{ live, checking, canStart, outOfTime: planView\?\.known \? planView\.outOfTime \?\? null : null \}\)/);
    assert.match(FLAT, /const note = startNote\(orb, offlineShown\);/);
  });
});
