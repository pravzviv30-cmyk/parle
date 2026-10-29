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
/** The B parts the tab is drawn from (2026-10-20 UI-008, artboard B-Journey), flattened. */
const PARTS_OF = (): string => stripComments(read('../journey/JourneyParts.tsx')).replace(/\s+/g, ' ');
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

// 2026-10-20, B4, B-Journey: the tab is the direction B Journey. What each
// block says is `journey/journeyView.ts`'s and is held by journeyView.test.ts;
// these read the screen for order, gates, reads and doors.
describe('Journey is Your French, the stage, the level, abilities, then and now, help, sounds and the week — B4', () => {
  test('a new account read clears the old evidence before rendering progress', () => {
    assert.match(FLAT, /const scope = scopeGeneration\(\); const sameAccount = \(\): boolean => !cancelled && scopeGeneration\(\) === scope; setReadOwner\(scope\); setReadyOwner\(null\); setStatus\('loading'\); setMissions\(\[\]\); setCompletions\(\[\]\);/);
    assert.match(FLAT, /setReadyOwner\(scope\); setStatus\('ready'\)/);
    assert.match(FLAT, /const renderStatus = ownedReadStatus\(status, readOwner, readyOwner, currentScope\)/);
    // 2026-10-20, B4, B-Journey: the page is drawn only for a ready read that is not the empty journey.
    // 2026-10-20 UI-008, artboard B-Journey: the ready page opens straight on its two columns inside the body.
    assert.match(FLAT, /renderStatus === 'ready' && !empty && \( <Columns>/);
    assert.match(FLAT, /setStory\(\{ sentences: \[\] \}\); setHeldBack\(false\);/, 'the last account\'s week or refusal survives a new read');
  });
  test('the blocks run in order: header, Your French, stages, abilities, then and now, help, sounds, week, tiles, rows', () => {
    // 2026-10-20, B4, B-Journey: replaces level, phrase bank, sounds map, conversations.
    // 2026-10-20 UI-008, artboard B-Journey: the band's white stat tiles and the B section heads.
    const order = ['<TabHeader', '<LivingBar', 'stats.map((stat) => <BandStat', '<YourFrenchSection view={yourFrench}', 'title={STAGE_HEADING}', 'title={CAN_DO_HEADING}', 'title={THEN_NOW_HEADING}', 'heading={HELP_HEADING}', 'title={SOUNDS_HEADING}', 'title={WEEK_HEADING}', 'tiles.map(', '{rows.map('];
    for (let i = 1; i < order.length; i += 1) assert.ok(at(order[i - 1]!) < at(order[i]!), `${order[i - 1]} is not drawn before ${order[i]}`);
    // 2026-10-22: Your French draws the phrases once; the old used section is gone.
    for (const gone of ['USED_HEADING', 'usedView', 'used.phrases']) assert.ok(!SCREEN.includes(gone), `${gone} is back on Journey`);
    assert.match(FLAT, /const yourFrench = yourFrenchView\(\{ deck, checks, progress: missions, completions, now, access: locks\.access \}\);/);
    // The one highlighter on Journey is Your French's featured phrase, drawn through YourFeatured.
    // 2026-10-22: Your French is drawn whole by JourneyParts' YourFrenchSection, so the featured phrase lives there.
    const PARTS_SRC = read('../journey/JourneyParts.tsx');
    assert.match(PARTS_OF(), /<JourneyHead title=\{view\.heading\} locked=\{false\} \/>/, 'Your French lost its own head');
    assert.equal((SCREEN.match(/<Highlight\b/g) ?? []).length, 0, 'the tab draws a highlighter of its own');
    assert.equal((stripComments(PARTS_SRC).match(/<YourFeatured\b/g) ?? []).length, 1, 'Journey draws more than one featured phrase');
    assert.equal((PARTS_SRC.match(/<Highlight\b/g) ?? []).length, 1, 'the Journey parts draw more than one highlighter');
    for (const retired of ['<PhraseBank', '<SoundsMap', 'title={DAILY_LINE}', 'title={BROWSE_LINE}', '<LevelCard', '<LevelXpCard', '<CountsGrid', '<PostcardShelf', '<StatRow', '<ColourCard', '<Chip ', '<IconAction']) assert.ok(!SCREEN.includes(retired), `${retired} is back on Journey`);
  });

  test('the stage is the spine\'s, said in words with "You\'re here" on the real one, and no rank anywhere', () => {
    // 2026-10-20, B4, B-Journey: the CEFR LevelCard became the five stages.
    assert.match(FLAT, /const stages = stagesFrom\(missions\);/);
    // 2026-10-20 UI-008, artboard B-Journey: the five 38pt nodes on their track, the current one brand with
    // its 4pt lavender ring and "You're here" (11/700) under its name, which
    // replaces the 2026-10-20 sim-nits flag and here-line chip. The node is
    // selected (accessibilityState) and the words say so; a done node keeps its tick.
    assert.match(FLAT, /<StageTrack steps=\{stages\.steps\} fill=\{stages\.fill\} moveUp=\{stages\.moveUp\} hereWord=\{YOU_ARE_HERE\} \/>/);
    const PARTS = stripComments(read('../journey/JourneyParts.tsx')).replace(/\s+/g, ' ');
    assert.match(PARTS, /steps\.map\(\(step\) => \{ const here = step\.state === 'here'; return \( <View key=\{step\.label\} style=\{s\.stage\} accessible accessibilityLabel=\{step\.accessibilityLabel\} accessibilityState=\{\{ selected: here \}\}>/);
    assert.match(PARTS, /\{here \? <Text style=\{\[bType\.bold11, s\.centred, \{ color: t\.link \}\]\}>\{hereWord\}<\/Text> : null\}/);
    assert.match(PARTS, /step\.state === 'done' \? <NodeTick/);
    assert.doesNotMatch(SCREEN, /totalXp\(|levelName|LEVELS\[|'A0'|'A1'/);
  });

  test('before the first conversation the page is the empty journey and its one start, through the gate', () => {
    // 2026-10-20, B4, B-Empty-States: replaces the first-visit LocalPracticeCard.
    assert.match(FLAT, /const firstVisit = isFirstVisit\(\{ progress: missions, deck, checks, packs: packs.length \}\);/);
    assert.match(FLAT, /const empty = renderStatus === 'ready' && isEmptyJourney\(firstVisit, completions\);/);
    // 2026-10-20 UI-008, artboard B-Journey / B-Empty-States: the butter card's 46pt ink start (BButton); Practise
    // your sounds became the sound row's link, so the tab draws no PillButton.
    gated('<BButton label={start.start} height={46} ground={t.primary}', '{empty && (', 400);
    assert.equal(tags(SCREEN, 'PillButton').length, 0);
    assert.equal(tags(SCREEN, 'BButton').length, 1, 'the empty journey carries other than one start');
    assert.match(FLAT, /<EmptyJourneyCard eyebrow=\{start\.picked\} title=\{start\.title\} body=\{start\.body\}>/);
    assert.match(PARTS_OF(), /<BArt name="map-route" width=\{150\} height=\{137\} \/>/);
    assert.match(FLAT, /const decision = tutorGate\(answered\); if \(!decision\.go\) \{ setHeldBack\(true\); return; \}/);
    assert.match(FLAT, /nav\.navigate\(decision\.screen, \{ missionId: start\.missionId, \.\.\.decision\.params \}\)/);
    gated('<LocalPracticeCard', 'heldBack &&', 300);
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
    // 2026-10-20, B4, B-Journey: counted once, for the rows and for the week in words.
    assert.match(FLAT, /const conversations = allConversations\(\{ packs, events: history \}\);/);
    assert.match(FLAT, /conversations: conversations\.length/);
    assert.match(FLAT, /reflectionFrom\(\{ story, recent: conversations, checks, progress: missions, now \}\)/);
    assert.match(FLAT, /row.kind === 'conversations'\) nav.navigate\('Conversations'\)/);
    assert.match(FLAT, /setHistory\(\[\.\.\.events, \.\.\.legacyMarkItems\(marks\)\]\); setReadyOwner\(scope\); setStatus\('ready'\)/);
  });

  test('the page keeps one primary, its lists as ledger rows, and no retired row', () => {
    // 2026-10-20, B4, B-Journey: one primary (the empty journey's start), the
    // rest secondary; the lists are the retry, the week in words and the rows.
    // 2026-10-20 UI-008, artboard B-Journey: the one primary is the empty journey's BButton (held above).
    assert.equal(tags(SCREEN, 'PillButton').length, 0);
    // 2026-10-20, lock seam wiring: plus the one teaser ledger every locked section shares.
    // 2026-10-20 UI-008, artboard B-Journey: the week in words left the ledger for the artboard's dot rows, 4 to 3.
    assert.equal(tags(SCREEN, 'Ledger').length, 3, 'retry, locked teaser, and the saved materials with the week story');
    assert.match(SCREEN, /earnedPostcards\(missions\)\.length/);
    assert.ok(SCREEN.includes('(rows.length > 0 || hasWeek) && ('));
    // 2026-10-20, B4, B-Journey: the header's numbers are the shared StatRow of
    // StatTiles, and the one outline button is the refused start's retry.
    for (const retired of ['<TintRow', '<IconRowCard', '<Stat ']) assert.ok(!SCREEN.includes(retired), `${retired} is back`);
    assert.equal(tags(SCREEN, 'OutlineButton').length, 1);
    gated('<OutlineButton', 'heldBack && (', 400);
  });

  test('every row goes somewhere and names itself', () => {
    const rows = tags(FLAT, 'LedgerRow');
    // 2026-10-07, come alive Phase 4 (F769): the postcards row became the
    // postcard shelf, whose heading row is the one door to Postcards.
    // 2026-10-20, B4, B-Journey: retry, week in words, week story, saved materials.
    // 2026-10-20, lock seam wiring: plus a locked section's teaser row, which opens the Wall.
    // 2026-10-20 UI-008, artboard B-Journey: the week in words is the artboard's dot rows (WeekRowView), 5 to 4.
    assert.equal(rows.length, 4, 'retry, locked teaser, week story and saved materials');
    for (const row of tags(FLAT, 'WeekRowView')) assert.match(row, /onPress=\{/);
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
    // 2026-10-20, B4, B-Journey: the rows are drawn inside the ready page.
    gated('{rows.map(', "renderStatus === 'ready' && !empty &&", 14000);
  });

  // 2026-10-20, B4, B-Journey: the doors and the locks of the new page.
  test('every door goes through the account fence to its view model\'s route', () => {
    assert.match(FLAT, /const go = \(route: JourneyRoute\) => \{ if \(!owned\(\)\) return; nav\.navigate\(route\.screen, 'params' in route \? route\.params : undefined\); \};/);
    assert.match(FLAT, /onPress=\{\(\) => go\(thenNow\.route\)\}/, 'the then and now card does not open Then and now');
    // 2026-10-20 UI-008, artboard B-Journey: "See all" is the head's 15/700 text link; Practise is the last sound row's link.
    assert.match(FLAT, /link=\{thenNow\.teaser !== null \? undefined : \{ label: SEE_ALL, accessibilityLabel: `\$\{SEE_ALL\}, \$\{THEN_NOW_HEADING\}`, onPress: \(\) => go\(thenNow\.route\) \}\}/);
    assert.match(FLAT, /onPress: \(\) => go\(sounds\.practise\)/, 'Practise does not open sound practice');
    assert.match(FLAT, /onPress=\{\(\) => \('sheet' in tile\.route \? setBadges\(true\) : go\(tile\.route\)\)\}/, 'the tiles do not open Postcards and the badge sheet');
    assert.match(FLAT, /<Sheet visible=\{badges\} title="Badges"/);
    assert.match(FLAT, /: \(\) => go\(row\.route!\)/, 'the week\'s next place does not open its scene');
  });

  test('a lock badge is drawn only where the view model says its seam locked it', () => {
    for (const gate of ['canDo.locked', 'thenNow.locked', 'help.locked', 'sounds.locked', 'week.locked']) {
      assert.ok(SCREEN.includes(gate), `${gate} is not asked`);
    }
    // 2026-10-20 UI-008, artboard B-Journey: the heads are JourneyHead, which draws the badge only when told the seam locked it.
    const PARTS = stripComments(read('../journey/JourneyParts.tsx')).replace(/\s+/g, ' ');
    assert.match(PARTS, /\{locked \? <LockBadge \/> : null\}/);
    for (const section of ['canDo', 'thenNow', 'sounds', 'week']) assert.match(FLAT, new RegExp(`locked=\\{${section}\\.locked\\}`), `${section}'s head is not told its lock`);
    // 2026-10-20, lock seam wiring: the help card says the lock in its own label when locked, so its badge is said once.
    assert.match(PARTS, /\{locked \? <LockBadge ground="card" said \/> : null\}/);
    assert.match(FLAT, /<HelpCard heading=\{HELP_HEADING\} line=\{help\.line\} locked=\{help\.locked\}/);
    assert.match(FLAT, /const locks = useFeatureAccess\(user\?\.id\);/);
    // 2026-10-22: Your French's locked parts leave the card (the view's `open`) and draw their teaser under it.
    // Drawn part by part from `open` (2026-10-22 review: never a .map, so the one highlighter stays one).
    // 2026-10-22: drawn by JourneyParts' YourFrenchSection from the view it is handed; its teaser opens the Wall through the tab's fence.
    for (const part of ['phrases', 'sounds', 'scenes']) assert.match(PARTS, new RegExp(`view\\.open\\.includes\\('${part}'\\)`), `${part} is not drawn from open`);
    for (const part of ['phrases', 'sounds']) {
      assert.match(PARTS, new RegExp(`\\{view\\.${part}\\?\\.teaser != null && teaser\\(view\\.${part}\\.teaser, view\\.${part}\\.feature\\)\\}`), `a locked ${part} part draws no teaser`);
    }
    assert.match(PARTS, /<LedgerRow title=\{line\} accessibilityLabel=\{line\} onPress=\{\(\) => onTeaser\(feature\)\} \/>/, 'a Your French teaser does not hand its feature back');
    assert.match(FLAT, /onTeaser=\{\(f\) => \{ if \(owned\(\)\) locks\.open\(f\); \}\}/, 'a Your French teaser opens the Wall outside the account fence');
    for (const section of ['canDo', 'thenNow', 'sounds', 'week']) {
      assert.match(FLAT, new RegExp(`\\{${section}\\.teaser !== null \\? teaser\\(${section}\\.teaser, ${section}\\.feature\\) : `), `a locked ${section} section draws its content instead of the teaser`);
    }
    assert.match(FLAT, /onPress=\{help\.teaser !== null \? \(\) => \{ if \(owned\(\)\) locks\.open\(help\.feature\); \} : undefined\}/);
    assert.match(FLAT, /<LedgerRow title=\{line\} accessibilityLabel=\{line\} onPress=\{\(\) => \{ if \(owned\(\)\) locks\.open\(feature\); \}\} \/>/, 'a teaser does not open the Wall');
    assert.doesNotMatch(SCREEN, /featureAccess\(|capabilitiesFor\(|useContinueArc\(/, 'the tab decides a lock itself');
  });

  test('French is tagged, decoration is hidden and the help is never a number', () => {
    // 2026-10-20 UI-008, artboard B-Journey: the lavender chips, the ability marks and the help line are journey/JourneyParts'.
    const PARTS = stripComments(read('../journey/JourneyParts.tsx')).replace(/\s+/g, ' ');
    assert.match(PARTS, /<UsedChip key=\{c\.front\} fr=\{c\.front\} tag=\{c\.held \? HELD_TAG : undefined\} \/>/);
    assert.match(PARTS, /<View style=\{s\.chip\}> ?<Text \{\.\.\.frenchText\}/);
    assert.match(PARTS, /s\.fr \? <Text key=\{i\} \{\.\.\.frenchText\}>/);
    assert.match(PARTS, /<Svg \{\.\.\.decorative\}/);
    assert.match(PARTS, /<Text style=\{\[bType\.bold17Loose, \{ color: t\.text \}\]\}>\{line\}<\/Text>/);
    assert.doesNotMatch(SCREEN, /unassistedRate|rungLabel|%/);
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

// 2026-10-21 UI-008, artboard B-Journey (simulator check): the band is the
// brand token in both themes, and the clock over it is light in both.
describe('the Journey band is brand blue with a light status bar', () => {
  test('the band reads t.brand, which is #3B2FE0 in light and dark, and the bar is light while focused', async () => {
    assert.match(FLAT, /band: \{ backgroundColor: t\.brand, borderBottomLeftRadius: 36, borderBottomRightRadius: 36,/);
    // 2026-10-21, simulator: the bar is a layout-free sibling before the
    // ScrollScreen, never a wrapper around it and never inside the scroll.
    assert.match(FLAT, /return \( <> \{focused \? <StatusBar style="light" \/> : null\} <ScrollScreen bottom="tab" padded=\{false\} bleedTop> <View style=\{st\.band\}>/);
    assert.match(FLAT, /<\/ScrollScreen> <\/> \); \} const ROW_TILE/, 'something besides the status bar sits beside the scroll');
    assert.match(FLAT, /const focused = useIsFocused\(\);/);
    const { b } = await import('../palette.ts');
    assert.equal(b.light.brand, '#3B2FE0');
    assert.equal(b.dark.brand, '#3B2FE0', 'the band turns navy in dark');
    assert.match(FLAT, /ink=\{t\.onBrand\}/);
    assert.match(FLAT, /color: t\.sun/);
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
