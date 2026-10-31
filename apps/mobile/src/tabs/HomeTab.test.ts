/**
 * What Today is allowed to decide, draw and leave out — F391, F392, F400,
 * F409, F571, the notebook redesign, and revamp B (F602).
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1), and again for revamp B. Today
 * shows still sand blocks until storage answers, then leads with exactly one
 * colour card, which `home/nextAction.ts` chooses: the blue scene brief for the
 * next scene on the CEFR spine (a meta line, the French title, the English,
 * the can-do as a sentence, one line to say, a white "Start speaking" and a
 * quiet "Type instead"), the blue recall card, or the sun plans card when the
 * free trial's minutes are used. Under it, white: "Where you're starting" with
 * a scene mark per can-do on day one, or the week's plain sentences with no
 * label (absent on a quiet week), under a slot for F609's lifetime count. Then
 * the review row when recall is not the lead, and today's phrase as a white
 * card with a play disc and "Practise it". No weekday, no weekly day count, no
 * rate and no tag.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen and the files it draws. The ceiling is honest: it proves the source
 * says the right thing in the right order, never that a phone drew it.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { localDayKey } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { sceneMeta } from '../home/estimate.ts';
import { STARTING_LABEL } from '../home/todayView.ts';
import { DAY_CHECK_MS, dayTurned, refreshClears } from '../home/homeRefresh.ts';
import { START, fallbackHero } from '../home/homeMission.ts';
import { PLANS_LEAD, dueLine } from '../home/nextAction.ts';
import { launchLabel } from '../tutor/orbState.ts';
import { TYPE_INSTEAD } from '../tutor/speakView.ts';
import { TUTOR_NAME } from '../tutor/tutorName.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One line, so a regex about an expression reads code and not the wrapping. */
const flat = (body: string): string => body.replace(/\s+/g, ' ');

const SCREEN_RAW = read('./HomeTab.tsx');
const SCREEN = stripComments(SCREEN_RAW);
const FLAT = flat(SCREEN);
/**
 * The render only, so the ordering checks read JSX and not the state hooks.
 * UI-015: the hero and the rows are built just before the return, from
 * `todayStops`, and handed to TodayLayout, so the render starts there.
 */
const RENDER = SCREEN.slice(SCREEN.indexOf('const stops = todayStops('));
const PHRASE_ROW = "<RouteRow key=\"phrase\" mark={last ? 'end' : 'stop'} last={last} thumb={<BArt name=\"voice-chat\" width={ROW_ART} height={ROW_ART} />} thumbGround={t.lavender} eyebrow={TODAY_COPY.phrase} title={daily.phrase.fr ?? daily.phrase.en} titleLang={daily.phrase.fr ? 'fr' : undefined} line={daily.phrase.fr ? daily.phrase.en : null} action={{ label: TODAY_COPY.sayRow }} onPress={() => nav.navigate(TODAY_ROUTES.phrase, { id: daily.phrase.id })} />";
/** TodayLayout draws its slots in this order; the screen fills them. */
const LAYOUT = stripComments(read('../home/TodayLayout.tsx'));

const HERO = stripComments(read('../home/MissionHero.tsx'));
const HERO_FLAT = flat(HERO);
/** 2026-10-31 UI-015: the hero's gated start moved, unchanged, into the hook Today's scene row shares. */
const LAUNCH_FLAT = flat(stripComments(read('../home/useSceneStart.ts')));
const RULE = stripComments(read('../home/homeMission.ts'));
const DAILY = stripComments(read('../daily/DailyCard.tsx'));

/**
 * Today's own file and every card it draws, which together are the surface.
 *
 * 2026-10-07, come alive Phase 4 (founder decisions D2, D5, D6): the hero
 * (`game/TodayHero.tsx`, since UI-015 `game/TodayStats.tsx` and
 * `game/TodayStatTiles.tsx`), its nudge line and the quests card
 * (`game/QuestsCard.tsx`) carry the founder-decided streak, the goal's "m of
 * g" minutes and the numbered level on Home, under their own tests
 * (`game/todayHeroView.test.ts`, `home/nudge.test.ts`,
 * `game/questsCardView.test.ts`). They are not listed here: this surface is
 * still the page's own words, and those still name no weekday, count no days
 * this week and show no rate.
 */
const HOME_SURFACE = [
  ['HomeTab.tsx', SCREEN],
  ['MissionHero.tsx', HERO],
] as const;

function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/** Where a marker sits on the screen, proven present so ordering is real. */
function at(marker: string, body = RENDER): number {
  const i = body.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

/** One style rule from the sheet at the foot of a file. */
function style(body: string, name: string): string {
  return between(body, `${name}: {`, '}', `${name} is a style this file defines`);
}

/** Every `<Tag ...>` in a body, whole, counting braces. */
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

/** Every quoted string in a body, minus the module paths nobody reads. */
function literals(body: string): string[] {
  return (body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? []).filter((line) => !line.includes('/') && !line.includes('${'));
}

/** The words in a body: quoted strings and JSX text. */
function spoken(body: string): string[] {
  const text = [...body.matchAll(/>\s*([A-Za-z][^<{}]*?)\s*</g)].map((m) => m[1]!);
  return [...literals(body), ...text];
}

describe('Today opens on a still greeting — F420, notebook Phase 3', () => {
  test('the greeting is static: the hour\'s French word, the first name, a full stop, and no rotation', () => {
    assert.match(FLAT, /import \{ homeGreeting \} from '\.\.\/home\/greeting\.ts'/, 'Today reads its greeting from somewhere other than the greeting rule');
    // UI-015 (founder 2026-10-30): direction A's sky brings back the hour's
    // word, so the greeting takes the first name and the moment, and the rule
    // picks the word. The screen never picks it itself, and the question under
    // the greeting stays retired.
    assert.match(FLAT, /const greeting = homeGreeting\(firstName, Date\.now\(\)\);/, 'the greeting is not built from the first name and the moment');
    assert.doesNotMatch(SCREEN, /Bonsoir|greetingWord|greetingSubline|greeting\.subline/, 'Today picks its greeting word itself instead of through homeGreeting');
    assert.ok(!SCREEN.includes('useGreetingRotation'), 'the rotating greeting is back on Today');
    assert.ok(!SCREEN.includes('titleSwap'), 'the header is handed a swap, so the greeting moves');
    assert.ok(!existsSync(fileURLToPath(new URL('../home/useGreetingRotation.ts', import.meta.url))), 'the rotation hook still ships');
    for (const forbidden of ['setInterval', 'setTimeout', 'Animated', 'requestAnimationFrame', 'accessibilityLiveRegion']) {
      assert.ok(!SCREEN.includes(forbidden), `Today carries ${forbidden}, and nothing may move here but the orb and the highlighter`);
    }

    // UI-015: Today has no TabHeader; the sky band draws the still greeting
    // (its header, one spoken line from greeting.title) and the profile button.
    assert.equal((SCREEN.match(/<TabHeader\b/g) ?? []).length, 0, 'Today draws a tab header under the sky');
    const sky = tags(RENDER, 'SkyBand')[0]!;
    assert.ok(sky, 'Today does not draw the sky band');
    assert.match(sky, /greeting=\{greeting\}/, 'the sky does not draw the still greeting');
    const band = stripComments(read('../home/SkyBand.tsx'));
    assert.match(band, /<Text accessibilityRole="header" accessibilityLabel=\{greeting\.title\}/, 'the greeting is not one header line to a screen reader');
    assert.doesNotMatch(SCREEN, /purpose="/, 'Today spells its purpose line as a literal');
    assert.match(sky, /profile=\{<ProfileButton ground=\{sky\.chip\} \/>\}/, 'the avatar must provide a consistent profile entry point');
    assert.ok(!SCREEN.includes('<Monogram'), 'the profile initial is back on Today beside the greeting');
    assert.ok(!SCREEN.includes('...type.display'), 'Today spreads the display line into its own stylesheet');
    assert.match(sky, /focused=\{focused\}/, 'the sky sets the light status bar while Today is not on top');

    // One name rule for the app.
    assert.match(FLAT, /import \{ firstNameOf \} from '\.\.\/tutor\/dashboard\.ts'/);
    assert.match(FLAT, /firstNameOf\(profile\.name\)/);
    assert.ok(!SCREEN.includes(".split(' ')"), 'Today hand-splits profile.name again');
    assert.ok(!SCREEN.includes("'you'"), 'Today falls back to calling the learner "you"');
    // A bottom tab stays mounted, so the refresh listens to focus.
    assert.match(SCREEN, /useIsFocused/, 'Today refreshes behind another tab');
  });
});

describe('Today leads with the next scene, as a brief', () => {
  test('the Home hero follows the placement', () => {
    // F917: the same placement Journey, Speak and the end cards pass to nextScene.
    assert.match(FLAT, /homeMissionFrom\(\{[^}]*startAt: startAtOf\(profile\)[^}]*\}\)/, 'the Home hero ignores the placement');
    assert.match(SCREEN, /import \{[^}]*\bstartAtOf\b[^}]*\} from '\.\.\/profile\/practicePreferences\.ts'/);
  });

  test("the hero is the spine's next scene, drawn on the blue brief with the meta line the rule decides", () => {
    // The rule reads the spine; the screen hands it the facts and decides nothing.
    assert.match(flat(RULE), /nextScene\(input\.progress, input\.goal \?\? null, input\.startAt \?\? null\)/, 'the hero is not chosen from the CEFR spine, leaning towards the goal');
    assert.match(FLAT, /const progress = missionStates\(missionCompletionsFrom\(completions\), deck, now\)/);
    assert.match(FLAT, /setHero\(homeMissionFrom\(\{ progress, records, levelIndex: standing\.index, goal: goalOf\(profile\), startAt: startAtOf\(profile\), now \}\)\)/, 'the hero is not the one homeMission.ts decides');
    // Revamp B (F602): the lead waits on the storage having answered and on
    // nothing else, and which lead it is belongs to the rule.
    assert.match(FLAT, /const unowned = readOwner !== scopeGeneration\(\);/, 'the lead must respond to live availability and account ownership');
    // UI-015: the hero card is split on whether storage has answered.
    assert.match(FLAT, /const loading = hero === null \|\| unowned;/, 'the page is not split on whether storage has answered');
    assert.match(FLAT, /\) : loading \? \( <Skeleton/, 'the page is not split on whether storage has answered');

    // Drawn on the one scene brief, and every field is the rule's. The meta
    // line is one sentence `sceneMeta` writes from the label, the minutes and
    // the tutor, so the brief cannot word them differently from Speak.
    assert.match(HERO_FLAT, /<SceneBrief /, 'the hero is not drawn on the scene brief');
    assert.ok(!HERO.includes('<HeroCard'), 'the hero is still the retired hero card');
    for (const field of [
      "meta={sceneMeta(hero.label ?? 'Next scene', hero.minutes, tutorName)}",
      'french={hero.french ?? undefined}',
      'title={hero.title}',
      'canDo={hero.canDo ? canDoSentence(hero.canDo) : undefined}',
      'line={hero.lines[0] ? { fr: hero.lines[0] } : undefined}',
    ]) {
      assert.ok(HERO_FLAT.includes(field), `the brief does not draw ${field}, so something else is deciding it`);
    }
    // The notebook brief's separate lines are gone from the call: the level,
    // the minutes with a clock, and the tutor are the one meta line now.
    for (const gone of ['level={', 'summary={', 'lines={', 'minutes={', 'minutesMark=', 'tutor={', 'ClockGlyph', 'minutesLine(', 'withTutor(']) {
      assert.ok(!HERO_FLAT.includes(gone), `the brief still hands SceneBrief ${gone}`);
    }
    assert.equal(sceneMeta('Next scene', 3, TUTOR_NAME), `Next scene, about 3 minutes with ${TUTOR_NAME}`);
    assert.equal(sceneMeta('Pick up where you left off', 1, TUTOR_NAME), `Pick up where you left off, about 1 minute with ${TUTOR_NAME}`);

    // The brief component is the one blue card, and draws the fields in the
    // board's order: the meta line, the French title over its English, the
    // can-do sentence, one line to say, any note, then the caller's Start.
    const components = stripComments(read('../components.tsx'));
    const brief = between(components, 'export function SceneBrief(', '\nexport function ', 'the scene brief is drawn in components.tsx');
    assert.match(brief, /<ColourCard ground="blue"/, 'the scene brief is not the blue colour card');
    const order = ['{meta}', '{french != null', '{canDo != null', '{line != null', '{note != null', '{action}', '{secondary'];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(at(order[i - 1]!, brief) < at(order[i]!, brief), `the brief draws ${order[i]} before ${order[i - 1]}`);
    }
    assert.doesNotMatch(brief, /fitHero\(|<Label\b/, 'the brief still sizes a serif hero or draws a caps label');
    assert.match(components, /const CAN_DO_LEAD = "You'll be able to";/);

    // No tint, no reason line and no rank: every block is a true fact.
    for (const gone of ['artTint', 'missionTint', 'reason=', 'readyLine', 'Ready for']) {
      assert.ok(!HERO.includes(gone) && !RULE.includes(gone), `the hero still carries ${gone}`);
    }
    // 2026-10-07, come alive Phase 4 (retention spec 1.4): a scene on the spine
    // carries its place drawing above the meta line, from the scene map, and
    // it is decorative and never pressable.
    assert.match(HERO_FLAT, /art=\{hero\.kind === 'scene' \? <SceneArt mission=\{hero\.mission\.id\} \/> : undefined\}/, "the brief does not draw the scene's place");
    const sceneArt = stripComments(read('../home/SceneArt.tsx'));
    assert.match(sceneArt, /<Illustration name=\{sceneIllustration\(mission\)\} fit="small" \/>/, 'the place drawing is not the one the scene map names');
    assert.match(sceneArt, /\{\.\.\.decorative\}/, 'the place drawing is announced to a screen reader');
    assert.doesNotMatch(sceneArt, /onPress|<Press\b|<Pressable\b/, 'the place drawing became a second target on the brief');
    assert.ok(at('{art != null ? art : null}', brief) < at('{meta}', brief), 'the drawing is not above the meta line');
    // Every word on the blue is in the blue ground's own colours.
    assert.doesNotMatch(HERO.slice(HERO.indexOf('<SceneBrief')), /paper\.inkSoft/, 'the brief sets soft ink on the blue');
    assert.match(HERO_FLAT, /<BookmarkGlyph size=\{20\} color=\{saved \? textOn\.blue : onColour\.blue\} \/>/, 'the bookmark is not drawn in the blue ground\'s colours');
    assert.match(HERO_FLAT, /checking: \{ \.\.\.type\.small, color: onColour\.blue/, 'the checking line is not the blue ground\'s secondary');
  });

  test('one Start speaking, white on the blue card, launching the scene directly, with the other mode as a quiet link', () => {
    assert.equal(TYPE_INSTEAD, 'Type instead');
    // Speak's words for Speak's control (F602): Home no longer says the bare
    // "Start" where Speak says "Start speaking".
    assert.equal(launchLabel({ checking: false, live: true, mode: 'speak' }), 'Start speaking');
    assert.equal(launchLabel({ checking: false, live: true, mode: 'type' }), 'Start typing');
    assert.notEqual(launchLabel({ checking: false, live: true, mode: 'speak' }), START);
    assert.ok(!/\bSTART\b/.test(HERO), 'the brief still labels its pill with the bare "Start"');

    assert.match(RENDER, /<NextTaskCard/);
    const shared = read('../practice/NextTaskCard.tsx');
    assert.match(shared, /<MissionHero hero=\{value.hero\}/);
    assert.match(shared, /<LocalPracticeCard/);
    assert.match(shared, /nextTaskKind/);
    // UI-015: the failed read is the hero card's body.
    const unread = between(FLAT, 'const heroCard = failedHero ? (', ') : loading ? (', 'failed reads have a working door');
    assert.equal((unread.match(/<PillButton\b/g) ?? []).length, 1);
    assert.match(unread, /navigate\('DailyPractice', \{ id: daily.phrase.id \}\)/);

    // The Start: white on the blue, Speak's words, an ink mic, and the scene
    // named to a screen reader.
    assert.match(LAUNCH_FLAT, /const \{ live, recheck \} = useLive\(\)/, 'the Start cannot say what an unreachable tutor means');
    assert.match(LAUNCH_FLAT, /const label = launchLabel\(\{ checking, live, mode: modes\.mode \}\)/, "the Start's words are not Speak's");
    // 2026-10-20, B5, B-Today: the blue brief's pill is the one inside
    // SceneBrief; Today's yellow lead is pinned in its own test below.
    const pill = flat(tags(HERO.slice(HERO.indexOf('<SceneBrief')), 'PillButton')[0]!);
    assert.match(pill, /tone="white"/, 'the Start is not the white pill on the blue');
    assert.match(pill, /label=\{label\}/);
    assert.match(pill, /accessibilityLabel=\{`\$\{label\}: \$\{hero\.title\}`\}/, 'the Start does not name its scene to a screen reader');
    assert.match(pill, /<MicGlyph size=\{20\} color=\{paper\.ink\} \/>/, 'the mic is not ink on the white pill');
    assert.match(pill, /disabled=\{checking\}/);

    // 2026-09-27 follow-up: the Start opens in the learner's standing mode
    // (Profile's "Prefer typing"), and the quiet link offers the other one:
    // "Type instead" for a speaker, "Speak instead" for a typist. On the blue
    // the link is white.
    assert.match(LAUNCH_FLAT, /const modes = startModes\(prefersTyping\(profile\)\)/, "Today ignores the learner's standing choice to type");
    assert.match(HERO_FLAT, /onPress=\{\(\) => open\(modes\.textMode\)\}/, 'Start does not open the scene in the preferred mode');
    assert.match(HERO_FLAT, /secondary=\{<IconAction layout="inline" icon=\{modes\.other\.textMode \? 'keyboard' : 'microphone'\} label=\{modes\.other\.label\} ground="blue"/, 'the quiet link under Start is not the other mode, in white');
    assert.match(HERO_FLAT, /onPress=\{\(\) => open\(modes\.other\.textMode\)\}/, 'the quiet link does not open the scene the other way');
    assert.ok(!/open\((true|false)\)/.test(HERO), 'the brief hard-codes a mode instead of reading the preference');
    assert.ok(!/<TabBar\b/.test(HERO) && !/<TabBar\b/.test(SCREEN), 'a Speak/Type segmented control is back on Today');

    // First run: the Start opens the scene by id through the gate, not the chooser.
    assert.match(flat(RULE), /params: \{ missionId: hero\.mission\.id \}/, 'a scene no longer opens on its own id');
    assert.match(LAUNCH_FLAT, /const start = heroStart\(hero\)/);
    assert.match(LAUNCH_FLAT, /nav\.navigate\(decision\.screen, \{ \.\.\.decision\.params, \.\.\.start\.params \}\)/);
    assert.match(LAUNCH_FLAT, /tutorGate\(answered, textMode\)/, 'the gate is not told which mode was asked for');
    for (const [path, body] of HOME_SURFACE) {
      assert.ok(!body.includes("navigate('Missions'"), `${path} sends a first run to the chooser instead of into the scene`);
    }
    assert.match(LAUNCH_FLAT, /name: 'mission_started', properties: \{ missionId: start\.missionId, entry: 'home' \}/);
  });

  test('the brief keeps its connection check and its held-back answer — F392', () => {
    // 2026-10-31 UI-015: the gate drives the shared start; the card draws its words.
    assert.match(LAUNCH_FLAT, /import \{ tutorGate \} from '\.\.\/tutor\/gate\.ts'/);
    assert.match(HERO_FLAT, /import \{ TUTOR_OFFLINE \} from '\.\.\/tutor\/gate\.ts'/);
    assert.match(HERO_FLAT, /const \{ open, checking, heldBack, label, modes \} = useSceneStart\(hero\);/, 'the hero does not start through the shared gated start');
    const opener = between(LAUNCH_FLAT, 'const open = ', 'return { open,', 'the card has an opener');
    assert.match(opener, /if \(checking\) return;/, 'a second tap while the probe is in flight can open a second room');
    assert.match(opener, /\.catch\(/);
    assert.ok(opener.indexOf('.then(') < opener.indexOf('.catch('));
    assert.doesNotMatch(opener, /\}, \(\) => \{/);
    assert.equal((opener.match(/setChecking\(false\)/g) ?? []).length, 2);
    assert.match(opener, /setHeldBack\(\{ textMode \}\)/, 'a start lost to a throw is dropped rather than kept for the retry');
    const heldBack = between(HERO.slice(HERO.indexOf('<SceneBrief')), 'heldBack !== null &&', '</View>', 'the card answers a start it could not honour');
    assert.match(heldBack, /\{TUTOR_OFFLINE\.body\}/);
    // Revamp B (F602): on the blue brief the retry is a white text link, not
    // an outline, and the sentence above it is white.
    assert.match(flat(heldBack), /<IconAction layout="inline" icon="refresh" busy=\{checking\} label=\{checking \? TUTOR_OFFLINE\.checking : TUTOR_OFFLINE\.retry\} ground="blue"/, 'the retry is not the white link on the blue');
    assert.match(HERO_FLAT, /offlineBody: \{ \.\.\.type\.body, color: paper\.onInk \}/, 'the held-back sentence is not white on the blue');
    assert.doesNotMatch(HERO, /OutlineButton/, 'an outline is back on the blue brief');
    assert.match(flat(heldBack), /onPress=\{\(\) => open\(heldBack\.textMode\)\}/, 'the retry is not the same start');
    assert.match(HERO, /\{checking && \(\s*<Text accessibilityLiveRegion="polite"/);
  });
});

describe('Today under the brief: the week, day one, and today\'s phrase', () => {
  // 2026-10-20, B5, B-Today: rewritten. The week sentences and the lifetime
  // count left Today: the week is the blue "Your week in French" card, and
  // the streak tile says the run. Day one still names where the learner
  // starts, and the page reads in the artboard's order.
  // 2026-10-20 UI-008, artboard B-Today: rewritten. "Where you're starting"
  // left Today (the artboard draws no day-one block; the stages and can-dos
  // live on Journey). The read still asks for it, because the arrival waits
  // on it, and the page reads in the artboard's order.
  test('day one draws no block of its own, and the page reads in the artboard order', () => {
    // 2026-10-29 (F934): Today's path takes its stops and the review row from the view.
    // UI-015: the hero and rows come from todayStops and rowMarks; pathStep's words left with RouteNode.
    assert.match(FLAT, /import \{ COMING_UP_COPY, TODAY_COPY, TODAY_ROUTES, comingUp, dismissComingUp, oneFix, reviewRow, rowMarks, startingPoint, todayStops, weekInFrench, type StartingPoint \} from '\.\.\/home\/todayView\.ts'/);
    assert.match(FLAT, /setStart\(startingPoint\(progress\)\)/);
    assert.match(FLAT, /ready=\{!interacted && !unowned && !readFailed && start !== null\}/, 'the arrival no longer waits for the read');
    assert.ok(!RENDER.includes('{start !== null && ('), 'the day-one block is back on Today');
    assert.ok(!SCREEN.includes('STARTING_LABEL') && !SCREEN.includes('<SceneMark'), 'Today still draws where the learner starts');
    assert.equal(STARTING_LABEL, "Where you're starting");

    // The week sentences, the lifetime count, the sheet and the friends card left Today.
    for (const gone of ['weekLines', 'storyFrom', 'reflectionFrom', '<DayCount', '<Sheet', 'More for today', 'WEEK_LABEL', 'friendsActivity', 'usefulFriends']) {
      assert.ok(!SCREEN.includes(gone), `Today still carries ${gone}`);
    }

    // Order, changed on purpose 2026-10-29 (F934, founder decision 6) and
    // again for UI-015: the sky (greeting and stats), the hero (the fix or the
    // lead), Today's path (the rows after it: scene, phrase, review), then the
    // three, Coming up and the week. The screen builds the hero and rows in
    // that order and TodayLayout draws its slots in that order.
    const order = ['fixHero', '<NextTaskCard vivid placement="hero"', '<NextTaskCard key="scene"', '<RouteRow key="phrase"', '<RouteRow key="review"', '<TodayStats', '<SkyBand', 'hero={heroCard}', 'rows={rows}', 'three={', 'comingUp={', 'week={'];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(at(order[i - 1]!) < at(order[i]!), `Today draws ${order[i]} before ${order[i - 1]}`);
    }
    const slots = ['{sky}', '{hero}', '<SectionTitle title={pathTitle} />', '{rows}', '{three}', '{comingUp}', '{week}'];
    for (let i = 1; i < slots.length; i += 1) {
      assert.ok(at(slots[i - 1]!, LAYOUT) < at(slots[i]!, LAYOUT), `TodayLayout draws ${slots[i]} before ${slots[i - 1]}`);
    }
    assert.doesNotMatch(flat(RENDER), /<Columns>/, 'the path is split into columns, so it no longer reads in order');
    assert.ok(!SCREEN.includes('<DailyCarousel'), 'the word and phrase carousel is back on Today');
    // The board's rhythm (UI-015, was B-Today's 22pt page gap): TodayLayout
    // sets the sections 30pt apart and pads the body 16pt at the sides.
    assert.match(LAYOUT, /const SECTION_GAP = 30;/);
    assert.match(LAYOUT, /section: \{ marginTop: SECTION_GAP \}/);
  });

  test('the four tiles, the rail, the old details and every rank name are gone', () => {
    for (const gone of [
      'HomeMomentum', 'momentumFrom', 'WeekRail', 'HomeProgressDetails', 'canDoRows', 'stampsFrom', 'loadActiveDays',
      'standing.name', 'levelName', 'Beginner', 'Veteran', 'StationLine', '<Stat', 'buildProgressReport',
      'Ready when you are', 'streak', '<AbilitiesCard', "navigate('Progress')", 'sceneForDaily', 'WordScene',
    ]) {
      for (const [path, body] of HOME_SURFACE) {
        assert.ok(!body.includes(gone), `${path} still carries ${gone}`);
      }
    }
    // The standing picks the daily pool and nothing else (HomeTab's one use).
    assert.match(FLAT, /const standing = levelFor\(totalXp\(activity\)\)/);
    assert.match(FLAT, /setDaily\(todayItems\(standing\.index, now\)\)/);
    // The shared card is picture-free everywhere, including the library.
    assert.doesNotMatch(DAILY, /WordScene|sceneForDaily|<Art\b|<Image\b|\bpicture\b/);
  });

  // 2026-09-27, notebook final sweep: these two moved here from
  // progress/momentumCards.test.ts when the momentum block was deleted. The
  // F391 test keeps its title because F391 and F422 name it; F438's successor
  // keeps what was about Today and Practice and drops the block's own link.
  test("home draws tier-selected daily French with audio first and no decorative scene — F391", () => {
    // The pool and the pick are core's. The screen reads them with the one
    // `now` it takes per focus and stores nothing, so the same day gives the
    // same word on a fresh install and on a two-year-old one.
    const catalogue = read('../daily/catalogue.ts');
    assert.match(catalogue, /dailyPick\(wordsForLevel\(homeWords, level\), now\)/);
    assert.match(catalogue, /homePhrases.filter\(p => p.tier === wordTierFor\(level\)\)/);
    assert.match(catalogue, /homeWords = DAILY_WORDS.filter\(item => voicedWords.has\(item.id\)\)/);
    assert.match(catalogue, /homePhrases = DAILY_PHRASES.filter\(item => voicedPhrases.has\(item.id\)\)/);
    assert.match(SCREEN, /todayItems/);
    assert.ok(!SCREEN.includes('Math.random'), 'the word is picked at random, so it would change under the learner mid-day');

    // The word is pitched, so it waits on storage: the tier comes from the
    // level standing and the level standing is XP that has to be read. Picked
    // before the read it would be a tier one word replaced a moment later,
    // which is the app appearing to change its mind about a learner.
    const awaited = between(
      FLAT,
      'void Promise.all(',
      'return () => {',
      'the screen no longer folds its storage reads together, so this walk reads the wrong half of the effect',
    );
    assert.match(
      awaited,
      /const standing = levelFor\(totalXp\(activity\)\);/,
      "the tier is not read from the app's one level standing, so the screen has grown a second opinion about how far a learner has come",
    );
    assert.match(
      awaited,
      /setDaily\(todayItems\(standing\.index, now\)\)/,
      "the word of the day is not today's word from the learner's tier, on the screen's one clock reading",
    );
    assert.ok(
      FLAT.indexOf('setDaily(todayItems(standing.index, now))') > FLAT.indexOf('void Promise.all('),
      'the word is picked before the XP is read, so a learner would watch it change tier a moment after it appeared',
    );

    // Revamp B (F602), UI-015: Today's phrase is one row on Today's path that
    // opens DailyPractice on today's item; the audio still has one owner, the
    // card (the library draws it) and DailyPractice.
    assert.ok(FLAT.includes(PHRASE_ROW), "Today does not draw today's phrase as its row");
    for (const source of [SCREEN, DAILY]) {
      assert.doesNotMatch(source, /<DailyCarousel|<WordScene|<WordOfDayCard|sceneForDaily\(/);
    }
    for (const field of ['item.fr', 'item.en', 'item.note', 'item.exampleFr', 'item.exampleEn']) {
      assert.ok(DAILY.includes(`{${field}}`), `the daily card does not draw ${field}`);
    }
    assert.match(DAILY, /<Label>\{item.label\}<\/Label>/);
    const hear = DAILY.indexOf('<IconAction layout="inline" icon="speaker" label="Hear"');
    assert.ok(hear >= 0 && hear < DAILY.indexOf('{item.fr}'));

    // No caption line, and no caption ink. Every word on this card is a word
    // the learner reads, and words clear 4.5; inkFaint measures under even the
    // mark floor on a card, which is how the least legible text in the app
    // happened once already.
    assert.ok(!DAILY.includes('inkFaint'), 'the word card sets learner-facing text in the faint ink');
  });

  test("Today's one recall action opens the review deck, Practice opens the same deck, and the hero sits outside every count — F438", () => {
    const shared = read('../practice/NextTaskCard.tsx');
    assert.match(shared, /recommendation\(\{ resumable: resumableOf\(saved, packs, bank\), deck, bank, packs, now \}\)/);
    assert.match(shared, /navigateOwned\('Drill'/);
    assert.match(shared, /navigateOwned\('Review'\)/);
    // 2026-10-20, B3, B-Practice: Practice reads the same deck through its
    // one reader, practice/useLibraryData.ts.
    assert.match(read('./PracticeTab.tsx'), /useLibraryData\(\)/);
    assert.match(read('../practice/useLibraryData.ts'), /loadDeck\(\)/);
    assert.match(shared, /resuming: saved\?\.targets.map/);

  });

  test('Today leads with one colour card: the next scene, the recall card, or the plans card when the free minutes are used', () => {
    assert.match(RENDER, /<NextTaskCard vivid placement="hero"/);
    const shared = read('../practice/NextTaskCard.tsx');
    // 2026-10-20 UI-008, artboard B-Today: Today's lead (vivid) is never the
    // blue practice or review card; a sitting to finish is Practice's.
    assert.match(shared, /if \(value.card !== null && !vivid\)/);
    assert.match(shared, /nextTaskKind\(\{ kind: 'none', fallback: 'first' \}, live, billing, !vivid && review !== null\)/);
    assert.match(shared, /kind === 'plans'/);
    assert.match(shared, /<ColourCard ground="blue"/);
    assert.match(shared, /<ColourCard ground="sun"/);
    assert.match(shared, /setBilling\(null\)/);
    assert.match(shared, /scope === scopeGeneration\(\)/);
    assert.match(shared, /fetchBillingStatus\(user.id\)/);
    assert.match(shared, /<LocalPracticeCard/);
    assert.doesNotMatch(shared, /best value|most popular|recommended plan/i);

  });

  test('a Home that has not read its storage yet draws still sand blocks shaped like the page', () => {
    assert.match(FLAT, /const \[hero, setHero\] = useState<HomeMission \| null>\(null\)/, 'Today starts with a scene it has not read');
    // The loading branch is the sand blocks and nothing else, so no card is
    // drawn before the lead it sits under.
    // UI-015: the hero slot's loading branch is the sand blocks and nothing
    // else, so no card is drawn before the lead it sits under.
    const loading = between(FLAT, ') : loading ? (', ') : (', 'the loading branch is its own');
    const skeleton = tags(loading, 'Skeleton');
    assert.equal(skeleton.length, 1, 'Today draws other than one skeleton while it loads');
    assert.equal(loading.replace(skeleton[0]!, '').replace(') : loading ? (', '').trim(), '', 'Today draws something beside the sand blocks while it loads');
    // Shaped like the page (UI-015): the hero card, the path's rows, the three.
    assert.equal(
      skeleton[0],
      "<Skeleton blocks={[{ height: 262, radius: radius.feature }, { height: 168, radius: radius.card }, { height: 196, radius: radius.card }]} />",
      'the sand blocks are not shaped like the page',
    );
    // Everything else waits: the rows, the three, Coming up and the week are
    // null while loading (or failed), and the lead is drawn only once loaded.
    assert.match(FLAT, /const rows = failedHero \|\| loading \? null :/);
    assert.match(FLAT, /three=\{failedHero \|\| loading \? null : three\}/);
    assert.match(FLAT, /comingUp=\{failedHero \|\| loading \|\| event === null \? null :/);
    assert.match(FLAT, /week=\{failedHero \|\| loading \|\| week === null \? null :/);
    assert.ok(FLAT.indexOf(') : loading ? (') < FLAT.indexOf('<NextTaskCard vivid placement="hero"'), 'the lead is drawn before storage has answered');
    // The greeting does not wait on storage: the sky is drawn in every branch.
    assert.doesNotMatch(FLAT, /sky=\{[^}]*loading/, 'the greeting waits on storage');

    // 2026-10-20, UI-008: shared parts read the theme (useB); b.light equals these paper values (palette.test.ts).
    // Still: the shared part is sand, read once as "Loading", and never moves.
    const components = stripComments(read('../components.tsx'));
    const part = between(components, 'export function Skeleton(', '\nexport function ', 'Skeleton is drawn in components.tsx');
    assert.match(part, /backgroundColor: t\.skeleton/);
    assert.match(part, /accessibilityLabel="Loading"/);
    assert.doesNotMatch(part, /Animated|useReduceMotion|loop/, 'the sand blocks shimmer');
  });

  // 2026-10-20, B5, B-Today: rewritten from the white card to the lavender
  // one. Hear plays the tutor's bundled clip and stops what it started; "Say
  // it yourself" stops the clip and opens DailyPractice. Free, so no lock.
  // 2026-10-20 UI-008, artboard B-Today: rewritten again. The card is the B
  // PhraseCard (lavender, radius 26, padding 18): the link-blue eyebrow, the
  // French at 22 bold over its English, the 48pt brand speaker and the 46pt
  // white "Say it yourself". The audio stays DailyCard's.
  test("today's phrase is the lavender card: the French with a play disc, the English, and Say it yourself", () => {
    // UI-015: Today draws its phrase as a row; the lavender card stays DailyCard's today look.
    assert.ok(FLAT.includes(PHRASE_ROW), "Today does not draw today's phrase as its row");
    assert.match(DAILY, /variant = 'full'/, 'the library look is no longer the default');
    const today = between(DAILY, "if (variant === 'today') {", 'return embedded ?', 'the daily card has a today look');
    const card = flat(today);
    assert.match(card, /<PhraseCard eyebrow="Today's phrase" fr=\{item\.fr\} en=\{item\.en\} hearLabel=\{`Hear \$\{tutorName\} say it`\} onHear=\{asset != null \? toggle : undefined\} playing=\{status\.playing\}/);
    assert.match(card, /sayLabel="Say it yourself" sayAccessibilityLabel="Say today's phrase yourself" onSay=\{sayIt\}/);
    assert.match(flat(DAILY), /const status = useAudioPlayerStatus\(player\)/, 'the disc cannot know the line is sounding');
    assert.match(flat(DAILY), /const asset = tutorAudioFor\(TUTOR_DAILY_AUDIO, item\.id, tutorVoice\)/, "Hear is not the tutor's bundled clip");
    const toggle = between(flat(DAILY), 'const toggle = ', '; const contents', 'the disc has one handler');
    assert.match(toggle, /if \(status\.playing\) \{ playTicket\.current\+\+; releaseDailyPlayback\(player\); \} else void play\(\)/, 'the disc does not stop what it started');
    const sayIt = between(flat(DAILY), 'const sayIt = ', '; const toggle', 'the practice has one handler');
    assert.ok(sayIt.indexOf('releaseDailyPlayback(player)') < sayIt.indexOf("nav.navigate('DailyPractice', { id: item.id })"), 'the practice opens over the tutor still speaking');
    assert.match(DAILY, /<IconAction layout="inline" icon="microphone" label="Say it" onPress=\{sayIt\} \/>/, 'the library and Today practise a phrase two ways');
    for (const gone of ['<Label', 'exampleFr', 'exampleEn', 'item.label', 'LockBadge', 'save()']) {
      assert.ok(!today.includes(gone), `today's phrase still carries ${gone}`);
    }
    const parts = flat(stripComments(read('../today/TodayParts.tsx')));
    const phrase = between(parts, 'export function PhraseCard(', 'const makeStyles', 'the phrase card is a Today part');
    assert.match(phrase, /accessibilityLabel=\{playing \? 'Stop' : hearLabel\}/, 'the speaker does not say Stop while it sounds');
    assert.match(phrase, /<Text \{\.\.\.frenchText\} selectable style=\{\[bType\.bold22, \{ color: t\.text \}\]\}>\{fr\}<\/Text>/, 'the French is not tagged as French at 22 bold');
    assert.match(parts, /phrase: \{ backgroundColor: t\.lavender, borderRadius: 26, padding: 18, gap: 10 \}/);
    assert.match(parts, /speaker: \{ width: 48, height: 48, borderRadius: 24, backgroundColor: t\.brand/, 'the speaker is not the 48pt brand disc');
  });

  test('Home names no weekday, counts no days this week, shows no rate and draws no tag', () => {
    const WEEKDAY = /\b(?:Mon|Tues|Wednes|Thurs|Fri|Satur|Sun)day\b|\b(?:lundi|mardi|mercredi|jeudi|vendredi|samedi|dimanche)\b/i;
    // The words the page spells, and the words its modules write for it.
    const hero = fallbackHero();
    const written = [
      ...Object.values(PLANS_LEAD),
      ...Array.from({ length: 40 }, (_, i) => dueLine(i + 1)),
      ...[1, 3, 12].map((m) => sceneMeta(hero.label ?? 'Next scene', m, TUTOR_NAME)),
    ];
    for (const [path, body] of HOME_SURFACE) {
      // A skeleton block's width ('60%') is a length, not a rate.
      const words = spoken(path === 'HomeTab.tsx' ? RENDER : body).filter((line) => !/^'\d+%'$/.test(line));
      for (const line of [...words, ...(path === 'HomeTab.tsx' ? written : [])]) {
        assert.doesNotMatch(line, WEEKDAY, `${path} names a weekday: ${line}`);
        assert.doesNotMatch(line, /this week|\bdays?\b/i, `${path} counts days: ${line}`);
        assert.doesNotMatch(line, /\d+ (?:of|out of) \d+|%|\d+ ?\/ ?\d+/, `${path} shows a rate: ${line}`);
        assert.doesNotMatch(line, /[·—–]/, `${path} carries a middot or a dash: ${line}`);
      }
      // A rate built in JSX or a template, not only one typed as a literal.
      assert.doesNotMatch(flat(body), /\} of \{|\} of \$\{|\} \/ \{/, `${path} builds an "N of M" rate`);
      // No weekly count and nothing that reads one.
      for (const gone of ['WEEK_LABEL', 'calendarWeekFrom', 'activeDays', 'daysActive', 'loadActiveDays', 'weekRail', 'DAYS_LABEL']) {
        assert.ok(!body.includes(gone), `${path} reads ${gone}`);
      }
      // No tag: no capsule, no chip, no caps label, no caps type.
      // 2026-10-20, B5, B-Today: the yellow lead carries one meta chip, "Builds
      // on", and only when the last conversation really meets the scene.
      const tagged = path === 'MissionHero.tsx' ? flat(body).replace(/\{buildsOn != null \? \( <Chip variant="meta"/, '') : body;
      assert.doesNotMatch(flat(tagged), /<(?:Chip|Tag|SoundTag|Pill|Badge|Label)\b/, `${path} draws a tag or a caps label`);
      assert.doesNotMatch(body, /radius\.(?:pill|chip)|borderRadius: 999|textTransform|uppercase/, `${path} draws a capsule or shouts`);
    }
  });

  test('every word Today spells is plain, and every import is used — F400', () => {
    for (const [path, body] of HOME_SURFACE) {
      const said = spoken(path === 'HomeTab.tsx' ? RENDER : body);
      assert.ok(said.length > 3, `only ${said.length} strings found in ${path}, so this sweep proves little`);
      for (const line of said) {
        assert.equal(guiltIn(line), undefined, `${path} says ${line}, which carries "${guiltIn(line)}"`);
        assert.doesNotMatch(line, /—/, `${path} says ${line}, which carries an em dash`);
      }
    }
    const body = SCREEN.slice(SCREEN.indexOf('export function HomeTab'));
    const imported = [...SCREEN.matchAll(/import \{([\s\S]*?)\} from/g)]
      .flatMap((m) => m[1]!.split(','))
      .map((name) => name.trim().replace(/^type\s+/, ''))
      .filter(Boolean);
    assert.ok(imported.length > 10);
    for (const name of imported) {
      assert.ok(new RegExp(`\\b${name}\\b`).test(body), `Today imports ${name} and never uses it`);
    }
    const header = SCREEN_RAW.slice(0, SCREEN_RAW.indexOf('*/'));
    assert.match(header, /NextTaskCard|scene brief/i, "Today's header does not describe the screen it now draws");
    assert.match(header, /My French/, "Today's header does not say where the counts went");
  });
});

describe('Today keeps its day when the disk will not answer', () => {
  test('an account switch clears the old recommendation before any new read resolves', () => {
    // 2026-10-07 (F768): the clearing waits on the account having changed, so
    // a refresh for the same account keeps the page drawn.
    assert.match(FLAT, /const scope = scopeGeneration\(\); setReadOwner\(scope\); if \(refreshClears\(drawnFor\.current, scope\)\) \{ setDaily\(todayItems\(0, now\)\); setHero\(null\); setStarter\(null\); setStart\(null\); setWeek\(null\); setFixFrom\(null\); \}/);
    assert.match(FLAT, /const unowned = readOwner !== scopeGeneration\(\);/);
    // UI-015: the failed read is the hero card's own branch.
    assert.match(FLAT, /const failedHero = !unowned && readFailed;/);
    assert.match(FLAT, /if \(cancelled \|\| scopeGeneration\(\) !== scope\) return;/);
    const shared = readFileSync(new URL('../practice/NextTaskCard.tsx', import.meta.url), 'utf8');
    assert.match(shared, /const scope = scopeGeneration\(\); setBilling\(null\)/);
    assert.match(shared, /if \(live && user !== null\)/);
    assert.match(shared, /!cancelled && scope === scopeGeneration\(\)/);
    assert.match(shared, /value.scope !== scopeGeneration\(\)/);
  });
  test('a storage read that fails offers local practice and retry without guessing a scene', () => {
    const readChain = between(FLAT, 'void Promise.all(', 'return () => {', 'Today folds its storage reads together');
    assert.match(readChain, /\.catch\(/);
    assert.ok(readChain.indexOf('.then(') < readChain.indexOf('.catch('));
    assert.doesNotMatch(readChain, /\}, \(\) => \{/);
    assert.match(readChain, /if \(cancelled \|\| scopeGeneration\(\) !== scope\) return;/);
    const rescue = readChain.slice(readChain.indexOf('.catch('));
    assert.match(rescue, /setReadFailed\(true\)/, 'a failed read must remain distinct from a fresh account');
    assert.match(FLAT, /const heroCard = failedHero \? \( <TodayHeroCard>/, 'the failed read is not drawn in the hero frame');
    assert.match(FLAT, /nav\.navigate\('DailyPractice', \{ id: daily\.phrase\.id \}\)/);
    assert.match(FLAT, /setReadAttempt\(\(n\) => n \+ 1\)/);
    for (const invented of ['setStart(', 'setWeek(', 'startingPoint(', 'missionStates(']) {
      assert.ok(!rescue.includes(invented), `a failed read draws ${invented} out of nothing`);
    }
    for (const shouted of ['Something went wrong', 'Try again', 'error', 'Error']) {
      assert.ok(!SCREEN.includes(shouted), `Today answers a storage fault with "${shouted}"`);
    }
  });

  test('the bookmark tap says it is working, and says when the write did not take', () => {
    const toggle = between(HERO_FLAT, 'const toggleBookmark', 'if (vivid)', 'the hero has a bookmark toggle');
    assert.match(toggle, /if \(bookmarkWrite === 'writing'\) return;/);
    assert.ok(toggle.indexOf("setBookmarkWrite('writing')") < toggle.indexOf('setBookmark('));
    assert.match(toggle, /\.then\(\(\) => loadBookmarks\(\)\)/);
    assert.match(toggle, /setBookmarkWrite\('refused'\)/);
    assert.match(HERO_FLAT, /const decisions = useMemo\(\(\) => bookmarkDecisions\(bookmarks\), \[bookmarks\]\)/);
    assert.match(HERO_FLAT, /disabled=\{bookmark\.busy\}/);
    assert.ok(!SCREEN.includes('bookmark'), 'Today is carrying the bookmark chain the hero owns');
  });
});

/* ===========================================================================
 * F409 — the two tabs fit a phone at every reading size.
 *
 * A source walk cannot measure a line box, so this is deliberately a list of
 * the ways a layout is made unable to adapt: a line capped at two, a reading
 * size capped by a multiplier, a text container pinned to a number of points, a
 * tile that cannot shrink beside its neighbour, a row under the touch floor.
 * Each of those is a thing somebody types, so each can be refused here, and the
 * measurement itself belongs to `docs/DEVICE_VERIFICATION.md`.
 * =========================================================================== */

/** Every file under `home/`, plus the two tabs this pass rebuilt. */
function surfaceFiles(): { path: string; body: string }[] {
  const homeDir = fileURLToPath(new URL('../home', import.meta.url));
  const cards = readdirSync(homeDir)
    .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
    .map((name) => ({ path: join('home', name), body: stripComments(readFileSync(join(homeDir, name), 'utf8')) }));
  return [
    { path: 'tabs/HomeTab.tsx', body: SCREEN },
    { path: 'tabs/TutorTab.tsx', body: stripComments(read('./TutorTab.tsx')) },
    ...cards,
  ];
}

describe('the two tabs fit a phone at every reading size — F409', () => {
  test('home and tutor wrap every line, cap no reading size, and keep every row at the touch floor — F409', () => {
    const files = surfaceFiles();
    assert.ok(files.length >= 6, `the walk found ${files.length} files, so it is checking almost nothing`);

    for (const { path, body } of files) {
      // Nothing truncates and nothing caps the reading size. A learner at the
      // largest text setting reads the same words as everybody else.
      for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'ellipsizeMode', 'allowFontScaling']) {
        assert.ok(!body.includes(capped), `${path} carries ${capped}, which clips a line rather than letting it wrap`);
      }
      // Every size is a token, so the whole page grows together.
      assert.doesNotMatch(body, /fontSize:/, `${path} names a raw font size instead of a type token`);
      // No container of words is pinned to a number of points. The picture is
      // sized by the art registry, which is the one place a scene's dimensions
      // live.
      assert.doesNotMatch(body, /\bwidth:\s*\d/, `${path} pins a container to a fixed width, which cannot wrap at large text`);
      // The frame owns the air above the tab bar, once.
      assert.ok(!body.includes('paddingBottom'), `${path} pads its own scroll over the frame's inset`);
    }

    // Both tabs sit on the frame, and neither reads the safe area nor opens a
    // scroll view of its own.
    for (const path of ['tabs/HomeTab.tsx', 'tabs/TutorTab.tsx']) {
      const body = files.find((file) => file.path === path)!.body;
      assert.match(body, /<ScrollScreen bottom="tab"/, `${path} is not built on the shared frame`);
      assert.ok(!body.includes('useSafeAreaInsets'), `${path} re-grows its own safe-area maths`);
      assert.ok(!body.includes('<ScrollView'), `${path} opens a scroll view of its own inside the frame's`);
    }
    assert.ok(!SCREEN.includes('st.scroll'), "Home's inner wrapper still grows against the shared scroll frame");

    // Every column of words that takes the rest of a row can shrink. `flex: 1`
    // alone gives a column its share and forbids it going below its content's
    // width, so at the largest reading size a French title beside a 44pt disc
    // pushes the disc, and then the card, off the screen.
    for (const { path, body } of files) {
      for (const rule of body.match(/\w+: \{[^}]*flex: 1[^}]*\}/g) ?? []) {
        assert.match(
          rule,
          /minWidth: 0/,
          `${path} gives a column its share of a row without letting it shrink, so its neighbour goes off the screen at large text: ${rule}`,
        );
      }
    }

    // Every row a learner can press on Home declares the touch floor, sized for
    // one hand while walking.
    for (const { path, body } of files.filter((file) => file.path.startsWith('home'))) {
      for (const tag of tags(body, 'Pressable')) {
        const named = [...tag.matchAll(/(?:st|s)\.([A-Za-z]+)/g)].map((m) => m[1]!);
        const floors = named.filter((name) => body.includes(`${name}: {`) && style(body, name).includes('minHeight: HIT'));
        assert.ok(floors.length > 0, `${path} draws a tappable row that does not declare minHeight: HIT`);
      }
    }
    // The two shared rows every tab is built from, held to the same floor: the
    // tinted row the tabs use for a place, and the white row Home uses for the
    // things that belong to no place. The white one is a card wrapped in one
    // Pressable, so its floor is the mark it carries, which is the touch floor
    // by construction.
    // 2026-09-27, notebook Phase 1: both shared rows are now the one LedgerRow
    // (TintRow and IconRowCard only forward to it), so the floor and the single
    // target are held where the row is drawn, one Pressable. Revamp B (F602):
    // SNIPPETS' list row sits at 60pt, over the touch floor with room to spare.
    const components = stripComments(read('../components.tsx'));
    assert.match(style(components, '  row'), /minHeight: HIT \+ space\(4\)/, 'the shared ledger row falls under its 60pt floor');
    const ledger = between(components, 'export function LedgerRow(', '\nexport function ', 'LedgerRow is drawn in components.tsx');
    // F630. Revamp B: the row presses through the one spring, `Press`, which
    // renders a single Pressable, so the row is still one target. A bare
    // Pressable beside it would be a second target, and that still fails.
    assert.equal((ledger.match(/<Press\b/g) ?? []).length, 1, 'the ledger row is not one press, so only its arrow would be tappable');
    assert.doesNotMatch(ledger, /<Pressable\b/, 'the ledger row carries a second target beside its one press');
    assert.doesNotMatch(components, /export function TintRow\b/);
    assert.equal(existsSync(fileURLToPath(new URL('../surface/IconRowCard.tsx', import.meta.url))), false);
  });

  /**
   * F631. The walk above reads only `<Pressable` tags, and Home's rows now
   * press through `Press`, the one spring, so a `<Press style={st.row}>` with
   * no floor would pass it unseen. This walks both, over every file under
   * `home/` and the two game cards Home draws (the hero and the quests), and
   * proves on synthetic rows first that it catches a `Press` with no floor and
   * does not read a `Pressable` as a `Press`.
   */
  test('every tappable row on Home declares the touch floor, whether it presses through Pressable or Press', () => {
    const floored = (body: string, tag: string): boolean => {
      const named = [...tag.matchAll(/(?:st|s)\.([A-Za-z]+)/g)].map((m) => m[1]!);
      return named.some((name) => body.includes(`${name}: {`) && style(body, name).includes('minHeight: HIT'));
    };
    const presses = (body: string): string[] => [...tags(body, 'Pressable'), ...tags(body, 'Press')];

    // The walk bites: a Press row with no floor is caught, a floored one passes,
    // and `<Press\b` does not also count every Pressable.
    const bare = "<Press haptic=\"light\" style={st.row} onPress={go}>x</Press>\nconst st = StyleSheet.create({ row: { flexDirection: 'row' } });";
    const held = "<Press haptic=\"light\" frame={st.frame} style={st.row} onPress={go}>x</Press>\nconst st = StyleSheet.create({ frame: { flexGrow: 1 }, row: { minHeight: HIT, flexDirection: 'row' } });";
    assert.equal(presses(bare).length, 1);
    assert.equal(floored(bare, presses(bare)[0]!), false, 'a Press row with no floor passes the walk');
    assert.equal(floored(held, presses(held)[0]!), true, 'a floored Press row fails the walk');
    assert.equal(tags('<Pressable style={st.corner}>', 'Press').length, 0, 'the Press walk reads a Pressable as a Press');

    const homeDir = fileURLToPath(new URL('../home', import.meta.url));
    const files = [
      ...readdirSync(homeDir)
        .filter((name) => /\.tsx$/.test(name))
        .map((name) => ({ path: join('home', name), body: stripComments(readFileSync(join(homeDir, name), 'utf8')) })),
      { path: 'game/QuestsCard.tsx', body: stripComments(read('../game/QuestsCard.tsx')) },
      // 2026-10-31 UI-015: Today's stat tiles press through the shared LipTile, floored there.
      { path: 'game/TodayStatTiles.tsx', body: stripComments(read('../game/TodayStatTiles.tsx')) },
    ];
    let walked = 0;
    for (const { path, body } of files) {
      for (const tag of presses(body)) {
        walked += 1;
        assert.ok(floored(body, tag), `${path} draws a tappable row that does not declare minHeight: HIT: ${flat(tag)}`);
      }
    }
    // UI-015 (was game/TodayHero.tsx's three Press tiles in one StatRow): the
    // stats are three labelled doors, each a LipTile, which presses through
    // Press at the touch floor (components.tsx lipStyles.hit, held in
    // home/todaySkyParts.test.ts); RouteRow presses through Press with its own floor.
    const tiles = files.find(file => file.path === 'game/TodayStatTiles.tsx')!.body;
    assert.equal((tiles.match(/<Tile layout=\{layout\} lip=\{sky\.lip\} label=\{labels\.\w+\} onPress=\{on\w+\}/g) ?? []).length, 3, 'the streak, the goal and the level need labelled targets');
    assert.equal(tags(tiles, 'LipTile').length, 1, 'each stat tile is not the one shared LipTile');
    assert.match(stripComments(read('../components.tsx')), /const lipStyles = StyleSheet\.create\(\{ hit: \{ minHeight: HIT \} \}\);/);
    assert.match(tiles, /<BArt name="flame" width=\{FLAME\.width\} height=\{FLAME\.height\}/);
    assert.ok(tags(files.find(file => file.path === 'home/RoutePath.tsx')!.body, 'Press').length === 1, 'a path row is not one press');
    // The three stat tiles press through LipTile (floored above), so they count as walked.
    walked += (tiles.match(/<Tile layout=/g) ?? []).length;
    assert.ok(walked >= 4, `the walk read ${walked} tappable rows on Home, so it is checking almost nothing`);
  });
});

describe('Home keeps what it has drawn — F768', () => {
  test('Home refreshes without ever showing its skeleton again once it has drawn', () => {
    // The rule: a read clears the page to the sand blocks only for an account
    // nothing has been drawn for, the first read or after a switch.
    assert.equal(refreshClears(null, 1), true, 'the first read does not start from the sand blocks');
    assert.equal(refreshClears(1, 1), false, 'a refresh for the same account takes the drawn page away');
    assert.equal(refreshClears(1, 2), true, "another account's page stays drawn while this account's read is on its way");

    // Walk it: draw once, refresh twice, switch account.
    let drawnFor: number | null = null;
    const skeletons: boolean[] = [];
    for (const scope of [1, 1, 1, 2]) {
      skeletons.push(refreshClears(drawnFor, scope));
      drawnFor = scope; // the read lands
    }
    assert.deepEqual(skeletons, [true, false, false, true], 'Home shows its sand blocks again after it has drawn for this account');

    // The minute timer asks whether the day turned, and reads nothing otherwise.
    const noon = new Date(2026, 9, 7, 12, 0, 0).getTime();
    const day = localDayKey(noon);
    assert.equal(dayTurned(day, noon + DAY_CHECK_MS), false, 'a minute passing reads the page again');
    assert.equal(dayTurned(day, noon + 11 * 60 * 60_000), false, 'an afternoon passing reads the page again');
    assert.equal(dayTurned(day, noon + 13 * 60 * 60_000), true, 'midnight does not bring the new day in');
    const refresh = flat(stripComments(read('../home/useHomeRefresh.ts')));
    assert.match(refresh, /setInterval\(\(\) => \{ if \(dayTurned\(readFor\.current, Date\.now\(\)\)\) refresh\(\); \}, DAY_CHECK_MS\)/, 'the timer reads Home again without the day having turned');
    assert.doesNotMatch(refresh, /setInterval\(refresh\b/, 'the timer still reads Home every minute');
    assert.match(refresh, /AppState\.addEventListener\('change', state => \{ if \(state === 'active'\) refresh\(\); \}\)/, 'a return to the foreground no longer reads Home again');

    // The screen holds to the rule: the page is cleared only behind it, the
    // account it drew for is recorded only once the read has landed, and the
    // one other clearing is the retry after a failed read, when nothing is drawn.
    const effect = between(FLAT, 'useFocusEffect(', '}, [profile, revision, readAttempt])', 'Home reads in one focus effect');
    const guarded = between(effect, 'if (refreshClears(drawnFor.current, scope)) {', '}', 'the clearing sits behind the refresh rule');
    assert.match(guarded, /setHero\(null\)/);
    assert.equal((effect.match(/setHero\(null\)/g) ?? []).length, 1, 'the focus effect clears the scene outside the refresh rule');
    const landed = between(effect, '.then(', '.catch(', 'the read has a landing');
    assert.match(landed, /drawnFor\.current = scope;/, 'Home never records what it drew, so every refresh clears');
    assert.equal((FLAT.match(/setHero\(null\)/g) ?? []).length, 2, 'something other than the rule and the failed-read retry clears the scene');

    // The lead card and the day count under it keep what they drew across a
    // refresh too, so the page under the hero does not blink.
    const task = flat(stripComments(read('../practice/NextTaskCard.tsx')));
    assert.match(task, /setValue\(held => \(held !== null && held\.scope === scope \? held : null\)\)/, 'the lead card blinks to its loading line on every refresh');
    assert.doesNotMatch(task, /setValue\(null\)/, 'the lead card still clears itself on every refresh');
    const days = flat(stripComments(read('../progress/DayCount.tsx')));
    assert.match(days, /setValue\(\(held\) => \(held !== null && held\.owner === owner \? held : null\)\)/, 'the day count blinks away on every refresh');
  });
});

/* 2026-10-20, B5, B-Today: the new page's own contract.
 * 2026-10-20 UI-008, artboard B-Today: rewritten for the rebuild to the
 * artboard in light and dark. The parts are today/TodayParts.tsx, every colour
 * a useB() token. */
const PARTS = stripComments(read('../today/TodayParts.tsx'));
const PARTS_FLAT = flat(PARTS);

describe('Today is drawn to B-Today, 2026-10-20, B5', () => {
  test('the yellow lead keeps the gated start and adds the eyebrow, the line and the honest chip', () => {
    const vivid = flat(between(HERO, 'if (vivid) {', 'return (\n    <SceneBrief', 'the hero has a Today look'));
    assert.match(vivid, /<SceneLead /, 'the lead is not the B yellow card');
    assert.match(vivid, /eyebrow=\{sceneEyebrow\(hero\)\}/, 'the eyebrow is not the scene place from the view model');
    // Founder, 2026-10-29: only the scene's length under the title.
    assert.match(vivid, /french=\{null\} rest=\{time\}/);
    assert.match(vivid, /uses=\{buildsOn != null \? buildsOnLine\(buildsOn\) : null\}/, 'the Uses chip is drawn without a real meeting');
    // The same start as the blue brief: the gate, the learner's mode, and the
    // other mode as a quiet link.
    assert.match(vivid, /start=\{\{ label, mode: modes\.mode, accessibilityLabel: `\$\{label\}: \$\{hero\.title\}, \$\{time\}`, disabled: checking, onPress: \(\) => open\(modes\.textMode\) \}\}/);
    assert.match(vivid, /other=\{\{ label: modes\.other\.label, disabled: checking, onPress: \(\) => open\(modes\.other\.textMode\) \}\}/);
    assert.match(vivid, /heldBack=\{heldBack === null \? null : \{ body: TUTOR_OFFLINE\.body, retry: TUTOR_OFFLINE\.retry, disabled: checking, onRetry: \(\) => open\(heldBack\.textMode\) \}\}/, 'the yellow lead lost its held-back answer');
    // 2026-10-31 UI-015: re-pinned from the yellow card to the scene hero on
    // the hero card's ground: the café in a 108 by 84 butter tile, the words
    // beside it while the card is wide enough (else the tile goes above), the
    // French still tagged, and the 54pt primary Start.
    const lead = between(PARTS_FLAT, 'export function SceneLead(', 'export function PhraseCard(', 'the lead is a Today part');
    assert.match(lead, /<View \{\.\.\.decorative\} style=\{\[s\.leadTile, \{ backgroundColor: t\.butter \}\]\}> <BArt name="cafe-table"/);
    assert.match(lead, /const side = sceneTileSide\(measured \?\? windowWidth - HERO_INSET, fontScale\);/);
    assert.match(lead, /<View style=\{side \? s\.leadSide : s\.leadStacked\}>/);
    assert.match(lead, /<Text \{\.\.\.frenchText\}>\{french\}<\/Text>/, 'the French title is not tagged as French');
    assert.match(lead, /<Text \{\.\.\.frenchText\}>\{uses\.french\}<\/Text>/, 'the quoted phrase is not tagged as French');
    assert.match(lead, /<Text accessibilityRole="header" style=\{\[bType\.stat24, \{ color: t\.text \}\]\}>\{title\}<\/Text>/);
    assert.match(lead, /height=\{54\} ground=\{t\.primary\} ink=\{t\.onPrimary\} text=\{bType\.bold16\} icon=\{start\.mode === 'type'/);
    assert.match(PARTS, /leadTile: \{ width: SCENE_TILE\.width, height: SCENE_TILE\.height, borderRadius: 20,/);
    assert.doesNotMatch(lead, /heroGround|heroText|heroCta/, 'the scene hero still draws the yellow card on the white one');
    assert.match(PARTS, /usesChip: \{[^}]*paddingVertical: 5, paddingHorizontal: 10, borderRadius: 12 \}/);
    // The engine is still main's lock-aware NextTaskCard.
    const task = read('../practice/NextTaskCard.tsx');
    assert.match(task, /const review = offeredReview\(value\.offer, locks\.access\('conversationPractice'\)\);/);
    assert.match(task, /<MissionHero hero=\{value\.hero\} vivid=\{vivid\} buildsOn=\{vivid \? value\.buildsOn : null\} \/>/);
    assert.match(task, /buildsOn: buildsOn\(packs, hero\)/);
    // 2026-10-29 (F934), re-pinned for UI-015: the lead is the hero when there
    // is no fix and the scene row when there is, and the starter card is drawn
    // by the lead rule (F936), with the same starter guard.
    assert.match(FLAT, /const starterFor = starter !== null && profile\.brain\.stats\.sessions === 0 \? starter : null;/);
    assert.match(FLAT, /\{stops\.hero === 'fix' \? fixHero : <NextTaskCard vivid placement="hero" starter=\{starterFor\} \/>\}/);
    assert.match(FLAT, /if \(row === 'scene'\) return <NextTaskCard key="scene" vivid placement="row" last=\{last\} starter=\{starterFor\} \/>;/);
  });

  test('one fix to try is English first, attempt first, names the day where known, and goes through the lock seam', () => {
    assert.match(FLAT, /const locks = useFeatureAccess\(user\?\.id\);/);
    assert.match(FLAT, /const fix = fixFrom === null \? null : oneFix\(\{ \.\.\.fixFrom, tutorName, access: locks\.access \}\);/);
    assert.match(FLAT, /replay: madeFromConversations\(\{ packs: fetched, marks, deck, checks, bank, now \}\)\?\.replay \?\? null, deck, bank, packs: fetched, now/, 'the fix cannot name the day of the conversation');
    // UI-015: the fix is the hero card's body, built once as fixHero.
    const card = flat(between(SCREEN, 'const fixHero = ', '\n  const loading', 'the fix card is built once'));
    assert.match(card, /fix !== null && \(/, 'the fix card is drawn with no replay');
    assert.match(card, /\{fix\.english\}/);
    assert.match(card, /\{fix\.after\}/);
    assert.doesNotMatch(card, /quote|better|why/, 'the fix card shows the learner\'s line or the better one before a try');
    assert.match(card, /\{fix\.locked && <View style=\{st\.lockRow\}><LockBadge feature="fixes" said \/><\/View>\}/, 'the lock is not drawn from the seam');
    assert.match(card, /accessibilityLabel=\{fix\.locked \? lockSaid\(TODAY_COPY\.fixAction, 'fixes', true\) : undefined\}/);
    assert.match(card, /onPress=\{\(\) => tapThrough\(locks\.access, fix\.feature, locks\.open, \(\) => nav\.navigate\(fix\.route\.screen, fix\.route\.params\)\)\}/, 'a locked fix does not open the Wall');
    assert.match(card, /<View \{\.\.\.decorative\}><OutlineLock size=\{18\} color=\{t\.muted\} \/><\/View>/, 'the outline lock beside the line is not hidden from a screen reader');
    assert.match(card, /height=\{50\} ground=\{t\.primary\} ink=\{t\.onPrimary\}/, 'the fix button is not the 50pt primary');
    // UI-015 (was: the RouteNode stop named the card): the hero names it with
    // its own eyebrow, "One fix to try" in link, a header, and the card is the
    // hero frame (TodayHeroCard), not the mint-edged card.
    assert.match(card, /<Text accessibilityRole="header" style=\{\[bType\.eyebrow, \{ color: t\.link \}\]\}>\{TODAY_COPY\.fix\}<\/Text>/);
    assert.match(card, /<Text style=\{\[bType\.bold20, \{ color: t\.text \}\]\}>\{fix\.english\}<\/Text>/);
    assert.match(FLAT, /<TodayHeroCard> \{stops\.hero === 'fix' \? fixHero :/);
    assert.match(style(SCREEN, 'after'), /minHeight: HIT/);
    assert.match(style(SCREEN, 'after'), /backgroundColor: t\.inset, borderRadius: 14/);
    assert.doesNotMatch(SCREEN, /borderColor: t\.mint/, 'the fix still draws its own mint-edged card inside the hero');
  });

  test("the week card says two sums and opens the week; it is absent on a quiet week", () => {
    // UI-015: the week sits under its outside title, and is null on a quiet week.
    const week = flat(between(RENDER, 'week={failedHero || loading || week === null ? null : (', '/>\n              </View>', 'the week card is drawn')) + '/>';
    assert.match(week, /<SectionTitle title=\{TODAY_COPY\.week\} \/>/, 'the week has no outside title');
    assert.match(week, /<WeekCard sentence=\{week\} link=\{TODAY_COPY\.seeWeek\} onLink=\{\(\) => nav\.navigate\(TODAY_ROUTES\.week\)\} \/>/, 'See your week does not open the weekly recap');
    const card = between(PARTS_FLAT, 'export function WeekCard(', 'export function SceneLead(', 'the week card is a Today part');
    // 2026-10-31 UI-015: re-pinned from the blue card to one card under an outside title.
    assert.match(card, /<View style=\{\[s\.week, \{ backgroundColor: t\.card \}\]\}>/);
    assert.match(card, /accessibilityRole="link"/);
    assert.match(card, /<Text style=\{\[bType\.bold14, \{ color: t\.text \}\]\}>\{link\}<\/Text>/, 'See your week is not the 14/700 link');
    assert.match(PARTS, /weekLink: \{ minHeight: HIT/);
    assert.doesNotMatch(SCREEN, /arrives on Monday/, 'the Monday recap promise is back');
  });

  // F941: "Start typing" drew a microphone, and the quiet link was a keyboard
  // even when it offered speaking. Each icon now names its own action.
  test("the start button's icon matches its mode", () => {
    assert.equal(launchLabel({ checking: false, live: true, mode: 'type' }), 'Start typing');
    assert.match(HERO_FLAT, /start=\{\{ label, mode: modes\.mode,/, 'the yellow lead is not told the mode');
    const lead = between(PARTS_FLAT, 'export function SceneLead(', 'export function PhraseCard(', 'the lead is a Today part');
    assert.match(lead, /icon=\{start\.mode === 'type' \? <KeyboardMark size=\{20\} color=\{t\.onPrimary\} \/> : <BMic size=\{20\} color=\{t\.onPrimary\} \/>\}/, 'the lead draws one icon for both modes');
    const pill = flat(tags(HERO.slice(HERO.indexOf('<SceneBrief')), 'PillButton')[0]!);
    assert.match(pill, /icon=\{modes\.mode === 'type' \? <KeyboardMark size=\{20\} color=\{paper\.ink\} \/> : <MicGlyph size=\{20\} color=\{paper\.ink\} \/>\}/, 'the brief pill draws one icon for both modes');
    assert.match(HERO_FLAT, /<IconAction layout="inline" icon=\{modes\.other\.textMode \? 'keyboard' : 'microphone'\} label=\{modes\.other\.label\}/, 'the quiet link draws a keyboard when it offers speaking');
  });

  // 2026-10-20 UI-008, artboard B-Today: rewritten from "no Coming up card"
  // (founder decision, plan.md "Data slots" 2). The card is drawn only from
  // the view model, with no countdown and no checklist.
  test('Coming up is drawn only from the remembered event, with no countdown or checklist, and no raw seconds, allowance or period end on Today', () => {
    assert.match(FLAT, /const event = comingUp\(\{ facts: visibleFacts\(profile\), paused: memoryPaused\(profile\.brain\), tutorName, access: locks\.access, now: Date\.now\(\) \}\);/, 'Coming up reads forgotten or paused memory');
    // UI-015: Coming up is null with no life event, and sits under its outside title.
    assert.match(RENDER, /comingUp=\{failedHero \|\| loading \|\| event === null \? null : \(/, 'Coming up is drawn with no life event');
    assert.match(RENDER, /<SectionTitle title=\{COMING_UP_COPY\.title\} \/>/);
    assert.match(FLAT, /onNotNow=\{\(\) => \{ dismissComingUp\(event\.key\); setHidden\(\(n\) => n \+ 1\); \}\}/, 'Not now does not hide the card');
    const card = between(PARTS_FLAT, 'export function ComingUpCard(', 'export function WeekCard(', 'Coming up is a Today part');
    assert.match(card, /voice \? <TutorPortrait voice=\{voice\} size=\{44\} ring=\{t\.text\} \/> : <BArt name="tutor-orb" width=\{44\} height=\{44\} \/>/);
    assert.match(card, /\{view\.locked \? <View style=\{s\.pillGap\}><LockBadge feature=\{view\.feature\} \/><\/View> : null\}/, 'the trial pill is not drawn from the lock');
    // 2026-10-31 UI-015: re-pinned to one lavender card, Rehearse the primary and Not now a quiet link.
    assert.match(card, /<View style=\{\[s\.comingUp, \{ backgroundColor: t\.lavender \}\]\}>/);
    assert.match(card, /label=\{COMING_UP_COPY\.rehearse\} height=\{44\} ground=\{t\.primary\}/);
    assert.match(card, /accessibilityLabel=\{`\$\{COMING_UP_COPY\.notNow\}, hide this for now`\} onPress=\{onNotNow\} style=\{s\.textLink\}/);
    assert.match(PARTS, /textLink: \{ minHeight: HIT/);
    for (const body of [SCREEN, PARTS, HERO, read('../home/todayView.ts')]) {
      assert.doesNotMatch(stripComments(body), /days away|Review the key|Talk it through|dinner in Lyon/, 'Coming up draws a countdown, a checklist or the artboard sample');
    }
    // UI-015: game/TodayHero.tsx became TodayStats.tsx and TodayStatTiles.tsx.
    for (const body of [SCREEN, HERO, PARTS, stripComments(read('../game/TodayStats.tsx')), stripComments(read('../game/TodayStatTiles.tsx')), stripComments(read('../game/QuestsCard.tsx'))]) {
      assert.doesNotMatch(body, /secondsRemaining|allowanceSeconds|periodEnd/, 'Today reads the raw allowance');
    }
    assert.doesNotMatch(SCREEN, /[·—]/, 'Today carries a middot or an em dash');
  });

  test("Today's three is on the page with a mark per quest, its count and its XP", () => {
    const quests = flat(stripComments(read('../game/QuestsCard.tsx')));
    assert.match(quests, /\{TODAY_COPY\.three\}/);
    assert.match(quests, /format=\{threeDone\}/);
    assert.match(quests, /row\.complete \? \( <CheckDisc size=\{MARK\} fill=\{t\.mint\} tick=\{t\.onMint\} \/>/, 'a done quest is colour alone');
    assert.match(quests, /<QuestRing size=\{MARK\} fraction=\{row\.fraction\} track=\{t\.lavender\} color=\{t\.brand\} \/>/);
    assert.match(quests, /accessible accessibilityLabel=\{row\.label\}/, 'the row and its ring are not labelled');
    assert.match(quests, /<View \{\.\.\.decorative\}>/, 'the quest mark is announced on its own');
    assert.match(quests, /<SmallPill label=\{trailing\.label\} ground=\{trailing\.kind === 'xp' && trailing\.earned \? t\.sage : t\.butter\} \/>/);
    assert.match(quests, /doneWords: \{ color: t\.muted, textDecorationLine: 'line-through' \}/, 'a done quest is not struck through');
    assert.match(quests, /card: \{ backgroundColor: t\.card, borderRadius: 22, paddingVertical: space\(1\), paddingHorizontal: space\(4\) \}/);
    assert.match(quests, /minHeight: 52/);
    assert.ok(!SCREEN.includes('<Sheet'), 'the quests sit in a sheet again');
  });

  test('Today follows the theme in dark: it is dark-ready, and no hex is spelled in its files', () => {
    assert.match(read('../nav/darkReady.ts'), /'Home',/, 'Today is not in DARK_READY');
    for (const [path, body] of [['HomeTab.tsx', SCREEN], ['TodayParts.tsx', PARTS], ['MissionHero.tsx', HERO], ['QuestsCard.tsx', stripComments(read('../game/QuestsCard.tsx'))], ['TodayStats.tsx', stripComments(read('../game/TodayStats.tsx'))], ['TodayStatTiles.tsx', stripComments(read('../game/TodayStatTiles.tsx'))], ['SkyBand.tsx', stripComments(read('../home/SkyBand.tsx'))], ['TodayHeroCard.tsx', stripComments(read('../home/TodayHeroCard.tsx'))], ['RoutePath.tsx', stripComments(read('../home/RoutePath.tsx'))], ['NextTaskCard.tsx', stripComments(read('../practice/NextTaskCard.tsx'))]] as const) {
      assert.doesNotMatch(body, /#[0-9A-Fa-f]{3,8}\b/, `${path} spells a colour outside palette.ts`);
    }
    for (const body of [SCREEN, PARTS, stripComments(read('../game/QuestsCard.tsx')), stripComments(read('../game/TodayStats.tsx')), stripComments(read('../game/TodayStatTiles.tsx')), stripComments(read('../home/SkyBand.tsx'))]) {
      assert.doesNotMatch(body, /\b(?:paper|colour|pastel|onColour|textOn)\.\w+/, 'a Today part reads a static light colour instead of the theme');
    }
  });
});
