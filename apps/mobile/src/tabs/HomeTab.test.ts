/**
 * What Today is allowed to decide, draw and leave out — F391, F392, F400,
 * F409, F571, and the notebook redesign.
 *
 * Rewritten 2026-09-27 (notebook Phase 3, B1). Today leads with a scene brief
 * for the next scene on the CEFR spine, in this order: the level, the French
 * title in the serif as the largest text, "You'll be able to" and the can-do,
 * two or three lines to say, the minutes, the tutor, one Start and a quiet
 * "Type instead". Then two plain sentences about the week (absent on a quiet
 * week), or "Where you're starting" on day one. Then today's phrase, audio
 * first, with no picture. The four empty tiles, the seven-dot rail, the
 * rotating greeting and every rank name are gone.
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

import { guiltIn } from '../copy/guilt.ts';
import { START } from '../home/homeMission.ts';
import { TYPE_INSTEAD } from '../tutor/speakView.ts';

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
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

const HERO = stripComments(read('../home/MissionHero.tsx'));
const HERO_FLAT = flat(HERO);
const RULE = stripComments(read('../home/homeMission.ts'));
const DAILY = stripComments(read('../daily/DailyCard.tsx'));

/** Today's own file and every card it draws, which together are the surface. */
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
    assert.match(FLAT, /const greeting = homeGreeting\(firstName, /, 'the greeting is not built from the first name and the clock');
    assert.ok(!SCREEN.includes('useGreetingRotation'), 'the rotating greeting is back on Today');
    assert.ok(!SCREEN.includes('titleSwap'), 'the header is handed a swap, so the greeting moves');
    assert.ok(!existsSync(fileURLToPath(new URL('../home/useGreetingRotation.ts', import.meta.url))), 'the rotation hook still ships');
    for (const forbidden of ['setInterval', 'setTimeout', 'Animated', 'requestAnimationFrame', 'accessibilityLiveRegion']) {
      assert.ok(!SCREEN.includes(forbidden), `Today carries ${forbidden}, and nothing may move here but the orb and the highlighter`);
    }

    assert.equal((SCREEN.match(/<TabHeader\b/g) ?? []).length, 1, 'Today draws more than one tab header');
    const header = tags(RENDER, 'TabHeader')[0]!;
    assert.match(header, /title=\{greeting\.title\}/, 'the header does not draw the still greeting');
    assert.match(header, /purpose=\{greeting\.subline\}/, "Today's purpose line is not the hour's question from the greeting rule");
    assert.doesNotMatch(SCREEN, /purpose="/, 'Today spells its purpose line as a literal');
    assert.match(SCREEN, /trailing=\{<ProfileButton \/>\}/, 'the avatar must provide a consistent profile entry point');
    assert.ok(!SCREEN.includes('<Monogram'), 'the profile initial is back on Today beside the greeting');
    assert.ok(!SCREEN.includes('...type.display'), 'Today spreads the display line into its own stylesheet');
    assert.match(style(SCREEN, 'head'), /position: 'relative'/);

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
  test('the hero is the spine\'s next scene, drawn on the scene brief in the brief\'s order', () => {
    // The rule reads the spine; the screen hands it the facts and decides nothing.
    assert.match(flat(RULE), /spineFrom\(input\.progress\)/, 'the hero is not chosen from the CEFR spine');
    assert.match(FLAT, /const progress = missionStates\(missionCompletionsFrom\(completions\), deck, now\)/);
    assert.match(FLAT, /setHero\(homeMissionFrom\(\{ progress, records, levelIndex: standing\.index, now \}\)\)/, 'the hero is not the one homeMission.ts decides');
    assert.match(SCREEN, /\{hero !== null && \(homeActionFor/, 'the hero is gated behind something other than having a scene');

    // Drawn on the one scene brief, and every field is the rule's.
    assert.match(HERO_FLAT, /<SceneBrief /, 'the hero is not drawn on the scene brief');
    assert.ok(!HERO.includes('<HeroCard'), 'the hero is still the retired hero card');
    for (const field of [
      'level={hero.level ?? undefined}',
      'french={hero.french ?? undefined}',
      'title={hero.title}',
      'canDo={hero.canDo ?? undefined}',
      'lines={hero.lines}',
      'minutes={minutesLine(hero.minutes)}',
      'tutor={withTutor(tutorName)}',
    ]) {
      assert.ok(HERO_FLAT.includes(field), `the brief does not draw ${field}, so something else is deciding it`);
    }
    // The brief component draws them in the design contract's order; the French
    // title is the serif hero and is sized by fitHero, which theme.test holds
    // above every UI head.
    const components = stripComments(read('../components.tsx'));
    const brief = between(components, 'export function SceneBrief(', '\nexport function ', 'the scene brief is drawn in components.tsx');
    const order = ['{caps', '{french != null', '{canDo != null', '{lines.length > 0', '{minutes != null', '{tutor != null', '{action}', '{secondary'];
    for (let i = 1; i < order.length; i += 1) {
      assert.ok(at(order[i - 1]!, brief) < at(order[i]!, brief), `the brief draws ${order[i]} before ${order[i - 1]}`);
    }
    assert.match(brief, /fitHero\(french\)/, 'the French title is not the serif hero');
    assert.match(components, /const CAN_DO_LEAD = "You'll be able to";/);

    // No picture, no tint, no reason line and no rank: every block is a true fact.
    for (const gone of ['art=', 'artTint', 'missionTint', 'heroArt', 'reason=', 'readyLine', 'Ready for']) {
      assert.ok(!HERO.includes(gone) && !RULE.includes(gone), `the hero still carries ${gone}`);
    }
  });

  test('one Start, launching the scene directly, and a quiet "Type instead" under it', () => {
    assert.equal(START, 'Start');
    assert.equal(TYPE_INSTEAD, 'Type instead');
    const pills = HOME_SURFACE.flatMap(([path, body]) => (body.match(/<PillButton\b/g) ?? []).map(() => path));
    assert.deepEqual(pills, ['HomeTab.tsx', 'MissionHero.tsx'], 'Today carries a pill outside its two exclusive templates');
    assert.match(HERO_FLAT, /<PillButton label=\{START\}/, "the brief's pill is not the one Start");
    // 2026-09-27 follow-up: the Start opens in the learner's standing mode
    // (Profile's "Prefer typing"), and the quiet link offers the other one:
    // "Type instead" for a speaker, "Speak instead" for a typist.
    assert.match(HERO_FLAT, /const modes = startModes\(prefersTyping\(profile\)\)/, "Today ignores the learner's standing choice to type");
    assert.match(HERO_FLAT, /onPress=\{\(\) => open\(modes\.textMode\)\}/, 'Start does not open the scene in the preferred mode');
    assert.match(HERO_FLAT, /secondary=\{<GhostButton label=\{modes\.other\.label\}/, 'the quiet link under Start is not the other mode');
    assert.match(HERO_FLAT, /onPress=\{\(\) => open\(modes\.other\.textMode\)\}/, 'the quiet link does not open the scene the other way');
    assert.ok(!/open\((true|false)\)/.test(HERO), 'the brief hard-codes a mode instead of reading the preference');
    assert.ok(!/<TabBar\b/.test(HERO) && !/<TabBar\b/.test(SCREEN), 'a Speak/Type segmented control is back on Today');

    // First run: the Start opens the scene by id through the gate, not the chooser.
    assert.match(flat(RULE), /params: \{ missionId: hero\.mission\.id \}/, 'a scene no longer opens on its own id');
    assert.match(HERO_FLAT, /const start = heroStart\(hero\)/);
    assert.match(HERO_FLAT, /nav\.navigate\(decision\.screen, \{ \.\.\.decision\.params, \.\.\.start\.params \}\)/);
    assert.match(HERO_FLAT, /tutorGate\(answered, textMode\)/, 'the gate is not told which mode was asked for');
    for (const [path, body] of HOME_SURFACE) {
      assert.ok(!body.includes("navigate('Missions'"), `${path} sends a first run to the chooser instead of into the scene`);
    }
    assert.match(HERO_FLAT, /name: 'mission_started', properties: \{ missionId: start\.missionId, entry: 'home' \}/);
  });

  test('the brief keeps its connection check and its held-back answer — F392', () => {
    assert.match(HERO_FLAT, /import \{ TUTOR_OFFLINE, tutorGate \} from '\.\.\/tutor\/gate\.ts'/);
    const opener = between(HERO_FLAT, 'const open = ', 'return (', 'the card has an opener');
    assert.match(opener, /if \(checking\) return;/, 'a second tap while the probe is in flight can open a second room');
    assert.match(opener, /\.catch\(/);
    assert.ok(opener.indexOf('.then(') < opener.indexOf('.catch('));
    assert.doesNotMatch(opener, /\}, \(\) => \{/);
    assert.equal((opener.match(/setChecking\(false\)/g) ?? []).length, 2);
    assert.match(opener, /setHeldBack\(\{ textMode \}\)/, 'a start lost to a throw is dropped rather than kept for the retry');
    const heldBack = between(HERO, 'heldBack !== null &&', '</View>', 'the card answers a start it could not honour');
    assert.match(heldBack, /\{TUTOR_OFFLINE\.body\}/);
    assert.match(heldBack, /<OutlineButton/);
    assert.match(flat(heldBack), /onPress=\{\(\) => open\(heldBack\.textMode\)\}/, 'the retry is not the same start');
    assert.match(HERO, /\{checking && \(\s*<Text accessibilityLiveRegion="polite"/);
  });
});

describe('Today under the brief: the week, day one, and today\'s phrase', () => {
  test('day one shows where the learner is starting; afterwards two week sentences, and nothing on a quiet week', () => {
    assert.match(FLAT, /import \{ STARTING_LABEL, WEEK_LABEL, startingPoint, weekLines, type StartingPoint \} from '\.\.\/home\/todayView\.ts'/);
    assert.match(FLAT, /setStart\(startingPoint\(progress\)\)/);
    assert.match(FLAT, /const story = storyFrom\(\{ sessions: history, activity, packs, completions, now \}\)/);
    assert.match(
      FLAT,
      /setWeek\(weekLines\(\{ story, reflection: reflectionFrom\(\{ story, recent: allConversations\(\{ packs, events \}\), checks, progress, now \}\) \}\)\)/,
      'the week sentences are not built from the week story and the reflection',
    );
    assert.match(RENDER, /\{start !== null \? \(/, 'day one is not its own branch');
    assert.match(RENDER, /<Label>\{STARTING_LABEL\}<\/Label>/);
    assert.match(RENDER, /\{start\.level\}/);
    assert.match(RENDER, /start\.canDos\.map\(/);
    assert.match(flat(RENDER), /: week\.length > 0 && \(/, 'the week block is drawn on a quiet week');
    assert.match(RENDER, /week\.map\(/);

    // Order: greeting, brief, then the week or day one, then today's phrase.
    assert.ok(at('<TabHeader') < at('<MissionHero'));
    assert.ok(at('<MissionHero') < at('{start !== null'));
    assert.ok(at('{start !== null') < at('<DailyCard'));

    // Today's phrase, audio first, with no picture.
    assert.match(RENDER, /<DailyCard item=\{daily\.phrase\} picture=\{false\} \/>/, "today's phrase is not the phrase, or still carries its picture");
    assert.ok(!SCREEN.includes('<DailyCarousel'), 'the word and phrase carousel is back on Today');
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
    // The phrase card may keep its picture elsewhere, but not on Today.
    assert.match(DAILY, /picture = true/);
  });

  test('every word Today spells is plain, and every import is used — F400', () => {
    for (const [path, body] of HOME_SURFACE) {
      const said = spoken(body);
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
    assert.match(header, /SceneBrief|scene brief/i, "Today's header does not describe the screen it now draws");
    assert.match(header, /My French/, "Today's header does not say where the counts went");
  });
});

describe('Today keeps its day when the disk will not answer', () => {
  test('a storage read that fails still leaves the next scene on the page, and claims nothing about the learner', () => {
    const readChain = between(FLAT, 'void Promise.all(', 'return () => {', 'Today folds its storage reads together');
    assert.match(readChain, /\.catch\(/);
    assert.ok(readChain.indexOf('.then(') < readChain.indexOf('.catch('));
    assert.doesNotMatch(readChain, /\}, \(\) => \{/);
    assert.match(readChain, /if \(cancelled \|\| scopeGeneration\(\) !== scope\) return;/);
    const rescue = readChain.slice(readChain.indexOf('.catch('));
    assert.match(rescue, /setHero\(fallbackHero\(\)\)/, 'a failed read leaves Today with no way into a scene');
    for (const invented of ['setStart(', 'setWeek(', 'startingPoint(', 'missionStates(']) {
      assert.ok(!rescue.includes(invented), `a failed read draws ${invented} out of nothing`);
    }
    for (const shouted of ['Something went wrong', 'Try again', 'error', 'Error']) {
      assert.ok(!SCREEN.includes(shouted), `Today answers a storage fault with "${shouted}"`);
    }
  });

  test('the bookmark tap says it is working, and says when the write did not take', () => {
    const toggle = between(HERO_FLAT, 'const toggleBookmark', 'const open =', 'the hero has a bookmark toggle');
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
    // target are held where the row is drawn, at 56pt, one Pressable.
    const components = stripComments(read('../components.tsx'));
    assert.match(style(components, '  row'), /minHeight: HIT \+ space\(3\)/, 'the shared ledger row falls under its 56pt floor');
    const ledger = between(components, 'export function LedgerRow(', '\nexport function ', 'LedgerRow is drawn in components.tsx');
    assert.equal((ledger.match(/<Pressable\b/g) ?? []).length, 1, 'the ledger row is not one pressable, so only its arrow would be tappable');
    for (const wrapper of ['../surface/IconRowCard.tsx']) {
      assert.match(flat(stripComments(read(wrapper))), /<LedgerRow /, `${wrapper} no longer draws the one ledger row`);
    }
    assert.match(flat(between(components, 'export function TintRow(', 'const s = StyleSheet.create(', 'TintRow is drawn')), /<LedgerRow /, 'the tinted row no longer draws the one ledger row');
  });
});
