/**
 * What Home is allowed to decide, draw and leave out — F420, F391, F392, F399,
 * F400, F409, F571 and F572.
 *
 * Revamp A cut this tab to three things: the greeting with the hour's question
 * under it, one hero card with one pill on it, and one row saying what the
 * learner can now do. The four momentum cards and the word of the day moved to
 * the Progress screen and their assertions moved with them, to
 * `progress/momentumCards.test.ts`, under the same titles: a test title is what
 * the ledger names, so the titles travel with the rules rather than with the
 * files.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen, the way `PracticeTab.test.ts` and `MyFrenchTab.test.ts` do, and with
 * the same machinery. That is a blunt tool and its ceiling is honest: it proves
 * the greeting is wired to the hook rather than to a timer of its own, never
 * that a word slid up a slot on a phone. `docs/DEVICE_VERIFICATION.md` owns the
 * half a source walk cannot see.
 *
 * The class of bug it is pointed at is the one a renderer would not catch
 * either: a screen quietly growing a second opinion about a rule that already
 * has a module. So the positive halves here are small — an import, a call, a
 * gate — and every assertion with weight in it is about what Home must NOT
 * have: a hand-split name, a spelled label, an invented colour, a count of any
 * kind, or one of the things the founder took off this page.
 *
 * Home is read together with the two cards it draws, because a pill moved into
 * a card is still a pill on the screen and a label spelled in a card is still a
 * label the module was supposed to own.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';
import { START_CONVERSATION } from '../home/homeMission.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/** One line, so a regex about an expression reads code and not the wrapping. */
const flat = (body: string): string => body.replace(/\s+/g, ' ');

/**
 * Home with its comments, for the one assertion that is about a comment.
 *
 * Everything else here reads the stripped file, because a comment cannot reach
 * glass. The exception is the file header: it is the only record of which rules
 * this screen is keeping and which the founder overturned, and a header that
 * describes the screen a file used to draw is what the next change gets built
 * from.
 */
const SCREEN_RAW = read('./HomeTab.tsx');
const SCREEN = stripComments(SCREEN_RAW);
const FLAT = flat(SCREEN);
/** The render only, so the ordering checks read JSX and not the state hooks. */
const RENDER = SCREEN.slice(SCREEN.indexOf('<ScrollScreen'));

/** The two cards Home draws, each read once. */
const HERO = stripComments(read('../home/MissionHero.tsx'));
const ABILITIES = stripComments(read('../home/AbilitiesCard.tsx'));
/** The shared hero card, for the one thing it must not have grown. */
const HERO_CARD = stripComments(read('../surface/HeroCard.tsx'));

/**
 * Home's own file and every card it draws, which together are the surface.
 *
 * A pill moved off a card into a file the card imports is still a pill on the
 * screen, and a word spelled one directory further away is still a word the
 * learner reads.
 */
const HOME_SURFACE = [
  ['HomeTab.tsx', SCREEN],
  ['MissionHero.tsx', HERO],
  ['AbilitiesCard.tsx', ABILITIES],
] as const;

/**
 * The text between two markers, with both proven present.
 *
 * `PracticeTab.test.ts`'s `between`, for its reason: `indexOf` answers -1 for
 * something that is not there, and a slice taken from -1 is a slice of the
 * wrong part of the file, so every assertion after it would be asked of text
 * nobody wrote.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/** Where a marker sits on the screen, proven present so ordering is real. */
function at(marker: string): number {
  const i = RENDER.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

/** One style rule from the sheet at the foot of a file. */
function style(body: string, name: string): string {
  return between(body, `${name}: {`, '}', `${name} is a style this file defines`);
}

/**
 * Every `<Tag ...>` in a body, whole, counting braces.
 *
 * `MyFrenchTab.test.ts`'s walk, and it is needed for the same reason: an
 * `onPress` arrow carries a `>` of its own, so a lazy regex stops inside the
 * tag and reports the wrong text as the element.
 */
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

/**
 * The words in a body: quoted strings and JSX text.
 *
 * `literals` alone is not enough. A label written as JSX text carries no
 * quotes, so a sweep built only on quoted strings would read the accessibility
 * roles and miss the lines a learner actually reads.
 */
function spoken(body: string): string[] {
  const text = [...body.matchAll(/>\s*([A-Za-z][^<{}]*?)\s*</g)].map((m) => m[1]!);
  return [...literals(body), ...text];
}

describe('Home opens on the day rather than on a summary — F420, F392, F571', () => {
  test('home opens on the swiping greeting alone, held still for reduce motion and read once by a screen reader — F420', () => {
    // The rotation is the hook's, whole. Home holds no timer, no interval and
    // no Animated value of its own: `useGreetingRotation` owns the two timers,
    // the native-driver swipe, the commit frame, the reduce-motion branch and
    // the teardown, and a second copy of any of that here is a second answer to
    // a settled question.
    assert.match(
      FLAT,
      /import \{ useGreetingRotation \} from '\.\.\/home\/useGreetingRotation\.ts'/,
      'Home never imports the greeting rotation, so it has no greeting to draw',
    );
    assert.match(
      FLAT,
      /useGreetingRotation\(\{ firstName, focused \}\)/,
      'the rotation is not fed the name and the focus flag, so it cannot stop when the tab is not on top',
    );
    for (const forbidden of ['setInterval', 'setTimeout', 'Animated.timing', 'Animated.loop', 'requestAnimationFrame']) {
      assert.ok(!SCREEN.includes(forbidden), `Home drives the greeting itself with ${forbidden}; that chain lives in the hook`);
    }
    assert.match(SCREEN, /useIsFocused/, 'Home passes a focus flag it never reads, so the greeting animates behind another tab');

    // Exactly one header, and the movement crosses into it as one value the
    // frame interpolates rather than as a display line escaping layout.tsx
    // into this stylesheet.
    assert.equal((SCREEN.match(/<TabHeader\b/g) ?? []).length, 1, 'Home draws more than one tab header');
    const header = tags(RENDER, 'TabHeader')[0];
    assert.ok(header, 'Home does not open on a tab header');
    assert.match(header, /titleSwap=\{greeting\.swap\}/, 'the header is handed no swap, so the greeting never moves');
    assert.ok(!SCREEN.includes('...type.display'), 'Home spreads the display line into its own stylesheet; that line lives in layout.tsx');

    // One fixed announcement, and it is the still line. A header renaming
    // itself every few seconds and announcing each new name is the most hostile
    // thing this app could do to somebody listening to it, so `title` is the
    // whole greeting at rest, which is also what a learner who asked for less
    // movement reads, and there is no live region anywhere near this row.
    assert.match(header, /title=\{greeting\.rest\}/, 'the header draws the moving word as its title instead of the still line');
    assert.ok(!header.includes('titleOpacity'), 'the header is still handed the fade the swipe replaced');
    assert.ok(
      !SCREEN.includes('titleAccessibilityLabel'),
      'Home still names the header separately; the still line is the title now, so a second label would be a second greeting',
    );
    assert.ok(!SCREEN.includes('greetingRest'), 'Home assembles the resting greeting itself; the hook returns it');
    assert.ok(!SCREEN.includes('accessibilityLiveRegion'), 'Home carries a live region, so the greeting would be announced again and again');

    // The line under the greeting is the hour's question, and it is the hook's
    // (F571). Home is the one tab whose purpose line changes through the day,
    // which is exactly why it may not be spelled here: a literal would be a
    // second answer to which part of the day it is, sitting under a greeting
    // that already answered it.
    assert.match(header, /purpose=\{greeting\.subline\}/, "Home's purpose line is not the hour's question from the greeting rule");
    assert.doesNotMatch(SCREEN, /purpose="/, 'Home spells its purpose line as a literal, so it would say "tonight" at breakfast');
    assert.doesNotMatch(SCREEN, /purpose=\{`/, 'Home builds its purpose line out of a template rather than reading the hour rule');
    for (const spelledSubline of ['Ready to speak French', 'this morning?', 'tonight?']) {
      assert.ok(!SCREEN.includes(spelledSubline), `Home spells "${spelledSubline}" itself; that line is greeting.ts's`);
    }

    // The greeting keeps what the founder left on it. No control beside it and
    // no monogram: the initial is Profile's, once, which is F337.
    assert.match(SCREEN, /trailing=\{<ProfileButton \/>\}/, 'the avatar must provide a consistent profile entry point');
    assert.ok(!SCREEN.includes('<Monogram'), 'the profile initial is back on Home beside the greeting');

    // The watercolour corner is behind the words, decorative, and sized by the
    // registry rather than here. A picture that eats a tap on a heading breaks
    // the screen, and one with a width written at the call site is the drift
    // the registry exists to prevent.
    assert.doesNotMatch(SCREEN, /<HeaderArt/, 'header art must not overlap the editorial masthead');
    assert.ok(!SCREEN.includes('<Image'), 'Home reaches for an image directly; Art.tsx is the one file that may');

    assert.match(style(SCREEN, 'head'), /position: 'relative'/, 'the header art has nothing to be absolute inside, so it cannot bleed off the corner');

    // One name rule for the app. `firstNameOf` splits it, here and on the tutor
    // dashboard, and a learner who skipped the question is never called "you".
    assert.match(FLAT, /import \{ firstNameOf \} from '\.\.\/tutor\/dashboard\.ts'/, 'Home splits the name somewhere other than the one place that splits names');
    assert.match(FLAT, /firstNameOf\(profile\.name\)/, 'Home does not read the learner name through firstNameOf');
    assert.ok(!SCREEN.includes(".split(' ')"), 'Home hand-splits profile.name again');
    assert.ok(!SCREEN.includes("'you'"), 'Home falls back to calling the learner "you"');
  });

  test("home's one pill is the mission hero's, and the situation card keeps none", () => {
    // One primary action on the page, and it is the spoken one. Counted across
    // Home and every card Home draws, because a pill moved into a card is still
    // a pill on the screen. The daily situation card folded into the hero in
    // revamp A, and it took its outline with it: there is one way into a
    // conversation on the screen whose whole job is to open one.
    const pills = HOME_SURFACE.flatMap(([path, body]) => (body.match(/<PillButton\b/g) ?? []).map(() => path));
    assert.deepEqual(pills, ['HomeTab.tsx', 'MissionHero.tsx'], 'Home carries two mutually exclusive hero templates');
    assert.match(SCREEN, /homeActionFor\(hero, due.length\) === 'review' \?/);
    assert.match(SCREEN, /: <MissionHero hero=\{hero\} \/>/);
    assert.equal(START_CONVERSATION, 'Start conversation');
    assert.match(HERO, /label=\{START_CONVERSATION\}/, "the tab's one pill is not the spoken conversation");
    assert.match(HERO, /icon=\{<MicGlyph/, 'the pill lost the microphone that says what it opens');
    // The shared card takes the action as a node so the caller keeps the
    // literal. A pill folded into it would move every tab's count into one
    // component and the one-pill rule would stop being checkable at all.
    assert.ok(!HERO_CARD.includes('<PillButton'), 'the shared hero card spells its own pill, so no tab can be counted any more');
    assert.match(flat(HERO_CARD), /action: ReactNode/, 'the hero card no longer takes its one action from the caller');
    assert.match(flat(HERO), /action=\{/, 'the hero does not hand its pill to the card as the action');
    for (const [path, body] of HOME_SURFACE) {
      assert.ok(!body.includes('<OutlineButton label="Talk'), `${path} grew a second way into a conversation back`);
    }
  });

  test("home's situation card opens the conversation through tutorGate with the daily seed topic, and drops the accent and level chrome — F392", () => {
    // The same gate the Tutor tab runs, in the same order, with the same words
    // on the way back. Two surfaces disagreeing about one dead server is how a
    // learner stops believing either of them.
    assert.match(flat(HERO), /import \{ TUTOR_OFFLINE, tutorGate \} from '\.\.\/tutor\/gate\.ts'/, 'the card decides for itself whether a start starts anything');
    assert.match(flat(HERO), /recheck\(\)\s*\.then\(\(answered\) => \{/, 'the card never re-probes the connection before opening a room');
    assert.match(flat(HERO), /tutorGate\(answered, false\)/, 'the card does not ask the gate, or asks it in text mode');
    assert.match(flat(HERO), /if \(checking\) return;/, 'a second tap while the probe is in flight can open a second room');

    // Today's scene opens on its seed topic, which is the pipe the token server
    // already carries, and a guided mission opens on its id. Which of the two
    // is a decision, so it is `heroStart`'s and not this card's: a screen that
    // worked it out itself is a screen that can open a mission with a scene's
    // topic on it.
    assert.match(
      flat(HERO),
      /nav\.navigate\(decision\.screen, \{ \.\.\.decision\.params, \.\.\.start\.params \}\)/,
      'the conversation does not open on what the hero rule decided to open it on',
    );
    assert.match(flat(HERO), /const start = heroStart\(hero\)/, 'the card works out for itself how the conversation opens');
    const rule = stripComments(read('../home/homeMission.ts'));
    assert.match(flat(rule), /seedTopic: seedTopicOf\(hero\.scenario\)/, "today's scene does not reach the tutor through the seed topic pipe");
    assert.match(flat(rule), /params: \{ missionId: hero\.mission\.id \}/, 'a guided mission no longer opens on its own id');
    // And a start is recorded against a mission only, because the six guided
    // situations are what that count is about.
    assert.match(flat(HERO), /name: 'mission_started', properties: \{ missionId: start\.missionId, entry: 'home' \}/, 'a start from the hero is not recorded as one');
    assert.match(flat(HERO), /if \(start\.missionId !== null\)/, 'a daily scene is counted as a mission start, which is a number about something else');

    // Held back is answered, not swallowed: the module's line and the module's
    // retry, and the retry is the same start rather than a smaller one.
    const heldBack = between(HERO, 'heldBack !== null &&', '</View>', 'the card answers a start it could not honour');
    assert.match(heldBack, /\{TUTOR_OFFLINE\.body\}/, 'a held-back start says nothing about why');
    assert.match(heldBack, /label=\{checking \? TUTOR_OFFLINE\.checking : TUTOR_OFFLINE\.retry\}/, 'there is no way to check again');
    assert.match(heldBack, /<OutlineButton/, 'the way to check again is drawn as a second primary');

    // Bookmark is the quiet control and every word on it is the module's. The
    // card is handed the whole button and decides none of it, because "Saved",
    // "Saving" and "Not saved yet" are three answers to one question and a card
    // holding two of them would be a second opinion about a store it cannot
    // read. It is a 44pt corner of the hero now rather than an outline under
    // it, so what it is has to reach a screen reader in words.
    assert.match(
      flat(HERO),
      /bookmarkControl\(saved, target\?\.titleEn \?\? hero\.title, bookmarkWrite\)/,
      'the hero decides for itself what the bookmark says, or asks without the fold it already built',
    );
    assert.match(
      flat(HERO),
      /accessibilityLabel=\{bookmark\.accessibilityLabel\}/,
      'the bookmark reaches a screen reader as an unnamed mark, naming no situation',
    );
    assert.match(flat(HERO), /<BookmarkGlyph/, 'the corner is no longer the bookmark the founder drew');
    assert.match(flat(HERO), /corner=\{/, 'the bookmark is not the card corner any more');
    for (const word of ['Bookmark', 'Saved', 'Saving', 'Removing']) {
      assert.ok(!HERO.includes(`'${word}'`), `the card spells "${word}" itself; that word is bookmarks/view.ts's`);
    }
    // Only a daily scene can be saved: the shelf holds scene ids and My French
    // resolves them back against the daily pool, so a mission id written into
    // it would be a save that quietly resolved to nothing.
    assert.match(flat(HERO), /const target = heroBookmark\(hero\)/, 'the hero works out for itself what a bookmark would save');
    assert.match(flat(rule), /hero\.kind === 'today' \? \{ id: hero\.scenario\.id/, 'the bookmark rule no longer saves the scene it is looking at');

    // The scene is the day's, pitched at the learner, and picked inside the
    // rule rather than on the screen. Read through the app's one level
    // standing, never a second opinion about how far a learner has come.
    assert.match(FLAT, /const standing = levelFor\(totalXp\(activity\)\)/, 'Home reads the tier somewhere other than the one level standing');
    assert.match(FLAT, /levelIndex: standing\.index/, 'the hero is chosen without knowing which tier to pitch the scene at');
    assert.match(
      flat(rule),
      /dailyPick\(scenariosForLevel\(DAILY_SCENARIOS, input\.levelIndex\), input\.now\)/,
      "today's scene is not picked by the day, or is not pitched at the learner it is shown to",
    );
    assert.ok(!SCREEN.includes('Math.random'), 'Home picks the scene at random, so it would change under the learner mid-day');

    // And the removals, each named so putting one back fails rather than drifts.
    for (const [path, body] of HOME_SURFACE) {
      for (const gone of ['Listen to accent', 'Immersive', 'B1', '<NextSituationCard', 'SpeakBubbles', '<Monogram', '<SituationCard']) {
        assert.ok(!body.includes(gone), `${path} still carries "${gone}", which the founder took off this page`);
      }
    }
    // The level chrome went with them: the ladder is My French's to draw.
    //
    // `levelFor` and `totalXp` came back in F423 and are deliberately not on
    // this list any more. Home reads the standing to pitch one scene and draws
    // none of it: no name, no rung, no rail, no number.
    for (const gone of ['StationLine', '<Stat', 'buildProgressReport', 'standing.name']) {
      assert.ok(!SCREEN.includes(gone), `Home still reaches for ${gone}; the level and the evidence are My French's to draw`);
    }
  });
});

describe('Home says what the learner can now do, and counts nothing — F399, F543, F572', () => {
  test("home draws the hero from homeMission's words and leaves the next-situation card to my french — F399, F543", () => {
    // Every word on the hero is the module's. The card spells no label, no
    // title, no body and no time line of its own.
    assert.match(
      flat(HERO),
      /import \{ START_CONVERSATION, heroBookmark, heroStart, type HomeMission \} from '\.\/homeMission\.ts'/,
      'the hero does not read its words from homeMission.ts',
    );
    assert.match(flat(HERO), /<HeroCard/, 'the hero is no longer drawn on the shared hero card');
    for (const field of ['label={hero.label}', 'title={hero.title}', 'body={hero.body}', 'art={hero.art}', 'reason={hero.reason}']) {
      assert.match(flat(HERO), new RegExp(field.replace(/[{}.]/g, '\\$&')), `the hero does not draw ${field}, so something else is deciding it`);
    }
    assert.match(flat(HERO), /artTint=\{missionTint\(hero\.place\)\}/, 'the hero art has no contextual paper wash, or invents one outside the place mapping');
    // The picture is the registry's, by place, so no screen spells a filename
    // and two screens drawing one place cannot drift apart.
    const rule = stripComments(read('../home/homeMission.ts'));
    assert.match(flat(rule), /import \{ heroArt \} from '\.\.\/art\/maps\.ts'/, 'the hero rule names picture files itself');
    assert.match(flat(rule), /art: heroArt\(/, 'the hero carries no picture, or names one that is not the place it happens in');
    assert.ok(!HERO.includes('heroArt('), 'the card looks up its own picture; the rule already decided it');

    // The one numeral on this page is a duration, said in the module's words,
    // beside the clock the mockup draws. Every other count left the tab.
    assert.match(flat(HERO), /timeLine=\{readyLine\(hero\.minutes\)\}/, 'the hero says how long in its own words rather than the estimate rule’s');
    assert.match(flat(HERO_CARD), /<ClockGlyph/, 'the time line lost the clock that says what the number is');
    assert.ok(!HERO.includes('Ready for'), 'the hero spells the time line itself; that sentence is estimate.ts’s');
    assert.doesNotMatch(HERO, /\bmin\b/, 'the hero spells a unit of time, which is the estimate rule’s word');

    // Core picks inside the rule, and Home hands it the facts: where every
    // scene stands, where one was left, whether anything has ever been spoken,
    // and which tier to pitch the day at. Home draws the answer and re-derives
    // nothing.
    assert.match(FLAT, /const progress = missionStates\(missionCompletionsFrom\(completions\), deck, now\)/, 'Home reads where the scenes stand somewhere other than core');
    assert.match(
      flat(FLAT),
      /setHero\( homeMissionFrom\(\{ progress, records, spokenBefore: hasSpokenBefore\(activity\), levelIndex: standing\.index, now, \}\), \)/,
      'the hero is not the situation homeMission.ts decides',
    );
    assert.match(SCREEN, /\{hero !== null && \(homeActionFor/, 'the adaptive hero must remain independent of the momentum gate');

    // "Real progress": one sentence over the same projection, so the hero and
    // the row beneath it can never disagree about one finish. The row is drawn
    // for a learner with nothing behind them too, because it is also how they
    // find out what this app keeps track of.
    assert.match(FLAT, /setRows\(canDoRows\(stampsFrom\(progress\)\)\)/, 'the inline abilities must use the passport projection');
    assert.match(SCREEN, /<HomeProgressDetails story=\{story\} rows=\{rows\} \/>/, 'Home must retain the weekly story and ability details inline');
    assert.doesNotMatch(SCREEN, /navigate\('Progress'\)/, 'the retired Progress destination must not return');
    assert.match(flat(ABILITIES), /<IconRowCard/, 'real progress is no longer the white row the mockup draws');
    assert.match(flat(ABILITIES), /label=\{can\.label\}/, 'the row spells its own heading');
    assert.match(flat(ABILITIES), /line=\{can\.line\}/, 'the row spells its own sentence');
    assert.match(flat(ABILITIES), /accessibilityLabel=\{can\.spoken\}/, 'the row reaches a screen reader as a caps label and an orphan sentence');
    // Green means ground already covered, here as everywhere, and it is a mark
    // rather than a word.
    assert.match(flat(ABILITIES), /<BadgeGlyph size=\{\d+\} color=\{signal\.good\} \/>/, 'the mark beside the sentence is not the green that means ground covered');
    assert.ok(!ABILITIES.includes('accent.'), 'the identity violet reached a row that reports a state');
    assert.ok(!ABILITIES.includes('signal.live'), "the tutor's red reached a row about the learner");

    // Ordering: the greeting, then the one thing to do, then the proof that the
    // last times counted.
    assert.ok(at('<TabHeader') < at('<MissionHero'), 'the hero is drawn above the greeting');
    assert.ok(at('<MissionHero') < at('<HomeMomentum'), 'the proof is drawn above the invitation');

    // What left Home. The next-situation card, the momentum block, the word of
    // the day and the outline to the tutor are all somewhere else now, and a
    // count of any kind is nowhere.
    for (const gone of [
      '<NextSituationCard', 'NEXT_SITUATION', 'Talk to ', 'SpeakBubbles', 'Nothing here yet', '<NextStepRow', 'NEXT_STEP',
      '<MomentumCards', '<WordOfDayCard', 'WORD_SCENES', 'DAILY_WORDS',
    ]) {
      assert.ok(!SCREEN.includes(gone), `Home still draws ${gone}, which belongs one level down now`);
    }
    for (const [path, body] of HOME_SURFACE) {
      for (const counted of ['streak']) {
        assert.ok(!body.includes(counted), `${path} draws ${counted}; every count on Home moved to the Progress screen`);
      }
    }
    assert.ok(!existsSync(fileURLToPath(new URL('../home/NextStepRow.tsx', import.meta.url))), 'the next-step row still ships and nothing renders it');
    // The two cards the fold retired are gone rather than orphaned, and the
    // Progress screen is where their content went.
    for (const retired of ['../home/SituationCard.tsx', '../home/NextSituationCard.tsx', '../home/MomentumCards.tsx', '../home/WordOfDayCard.tsx']) {
      assert.ok(!existsSync(fileURLToPath(new URL(retired, import.meta.url))), `${retired} still ships and nothing on Home renders it`);
    }
  });
});

describe('Home closes on a kind line and carries nothing else — F400', () => {
  test('home closes on the sprout note and imports nothing it does not draw — F400', () => {
    // The sprout footer went with the fold: Home is two cards now and a closing
    // note under them would be a third thing on a screen the founder cut to
    // one decision. What the note was defending has not moved, and the sweep
    // below is where it is defended. Nothing on this surface scolds, hurries or
    // apologises, and nothing on it carries an em dash.
    assert.ok(!SCREEN.includes('<SproutGlyph'), 'the closing note is back on a screen the founder cut to two cards');
    assert.ok(!SCREEN.includes('marginTop: \'auto\''), 'Home still pushes a footer to the foot of a short screen');

    // Every word a learner could read on this surface, swept. The abilities
    // card spells nothing of its own: every word on it is abilities.ts's, and
    // that module is swept in its own suite.
    const wordless = ['AbilitiesCard.tsx'];
    for (const [path, body] of HOME_SURFACE) {
      const said = spoken(body);
      if (!wordless.includes(path)) assert.ok(said.length > 3, `only ${said.length} strings found in ${path}, so this sweep proves little`);
      for (const line of said) {
        const banned = guiltIn(line);
        assert.equal(banned, undefined, `${path} says ${line}, which carries the banned word "${banned}"`);
        assert.doesNotMatch(line, /—/, `${path} says ${line}, which carries an em dash`);
      }
    }

    // The cards nothing draws any more are gone rather than orphaned.
    for (const retired of ['../home/TodayRow.tsx', '../home/PhrasebookCard.tsx']) {
      assert.ok(!existsSync(fileURLToPath(new URL(retired, import.meta.url))), `${retired} still ships and nothing renders it`);
    }
    // `progress/today.ts` stays. Its suite is the standing defence against a
    // streak, and the fold deliberately did not touch it.
    assert.ok(
      existsSync(fileURLToPath(new URL('../progress/today.ts', import.meta.url))),
      'today.ts went with the row that drew it, and its suite is the defence against a streak',
    );
    for (const gone of ['todayFrom', 'buildPhrasebook', 'PhrasebookScreen', 'loadTopics']) {
      assert.ok(!SCREEN.includes(gone), `Home still reads ${gone}, and nothing on the page draws it`);
    }
    // History is now used by the weekly story, expanded inline on Home.
    assert.match(FLAT, /loadHistory\(\)/);
    assert.match(FLAT, /setStory\(storyFrom\(\{ sessions: history, activity, packs, completions, now \}\)\)/);
    assert.match(FLAT, /<HomeProgressDetails story=\{story\} rows=\{rows\} \/>/);

    // And nothing else is carried either. Every name Home imports is a name
    // Home uses, which is J14's rule applied to one file.
    const body = SCREEN.slice(SCREEN.indexOf('export function HomeTab'));
    const imported = [...SCREEN.matchAll(/import \{([\s\S]*?)\} from/g)]
      .flatMap((m) => m[1]!.split(','))
      .map((name) => name.trim().replace(/^type\s+/, ''))
      .filter(Boolean);
    assert.ok(imported.length > 10, 'the import walk found almost nothing, so it is checking nothing');
    for (const name of imported) {
      assert.ok(new RegExp(`\\b${name}\\b`).test(body), `Home imports ${name} and never uses it`);
    }

    // And the header says what the page now does, rather than the screen it
    // used to draw. A file whose header describes the last version of itself is
    // a file somebody will build the next change from.
    const header = SCREEN_RAW.slice(0, SCREEN_RAW.indexOf('*/'));
    assert.doesNotMatch(header, /seven blocks/i, "Home's header still promises the seven-block screen the fold replaced");
    assert.match(header, /Progress/, "Home's header does not say where the counts went");
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
    const components = stripComments(read('../components.tsx'));
    assert.match(style(components, 'tintRow'), /minHeight: HIT/, 'the shared tinted row falls under the touch floor');
    const iconRow = stripComments(read('../surface/IconRowCard.tsx'));
    assert.match(style(iconRow, 'disc'), /height: DISC/, "the white row's mark is no longer sized by the touch floor");
    assert.match(flat(iconRow), /<Pressable/, 'the white row is not one pressable, so only its arrow would be tappable');
  });
});

/**
 * The three ways Home stopped answering while still looking fine.
 *
 * A storage read with no rejection path leaves the hero and the sentence null
 * for the rest of the visit, with no error and nothing to press. A bookmark tap
 * with no acknowledgement leaves the mark still while two round-trips run, and
 * no rejection path leaves a failed write looking exactly like one that took.
 * And one boolean about the saved list was rebuilt out of the whole decision
 * store, twice, on every render.
 *
 * Read as source, because there is no renderer in this suite (docs/TESTING.md).
 * The ceiling is honest: this proves the rejection paths exist and say what
 * they say, never that a learner saw a card.
 */
describe('Home keeps its day when the disk will not answer', () => {
  test('a storage read that fails still leaves today on the page, and claims nothing about the learner', () => {
    const readChain = between(FLAT, 'void Promise.all(', 'return () => {', 'Home folds its storage reads together');
    assert.match(
      readChain,
      /\.catch\(/,
      'the storage read is never answered when it fails, so the hero and the sentence stay null for the rest of the visit',
    );
    assert.ok(
      readChain.indexOf('.then(') < readChain.indexOf('.catch('),
      'the rejection is handled before the answer is, so the chain reads backwards',
    );
    // At the END of the chain, not beside the fulfilment handler. `dailyPick`
    // throws on an empty pool by design, so the handler above is a real
    // thrower, and an onRejected passed alongside it would never see it.
    assert.doesNotMatch(
      readChain,
      /\}, \(\) => \{/,
      'the rejection is a second argument to .then, which cannot see a throw from the handler beside it',
    );

    const rescue = readChain.slice(readChain.indexOf('.catch('));
    // What survives: the hero, on the café, with the hour's own label. True of
    // the café for every learner alive, so it claims nothing about the one who
    // could not be read, and the page keeps its one pill.
    assert.match(rescue, /setHero\(fallbackHero\(now\)\)/, 'a failed read leaves Home with no way into a conversation');
    assert.match(
      FLAT,
      /import \{ fallbackHero, homeMissionFrom, type HomeMission \} from '\.\.\/home\/homeMission\.ts'/,
      'Home decides for itself what to offer a learner it could not read',
    );
    // And what does not. "Your first conversation is where this starts", said
    // to somebody who has been practising for months, is the app forgetting
    // them, so the sentence is withheld rather than guessed.
    for (const invented of ['setCan(', 'canDoSentence(', 'stampsFrom(', 'missionStates(']) {
      assert.ok(!rescue.includes(invented), `a failed read draws ${invented} out of nothing, which is a claim about a learner nobody could read`);
    }
    // Nothing is shown about the disk either. A learner cannot act on a storage
    // fault, and the page still carries the greeting, the hero and the one pill.
    for (const shouted of ['Something went wrong', 'Try again', 'error', 'Error']) {
      assert.ok(!SCREEN.includes(shouted), `Home answers a storage fault with "${shouted}", which is a screen about itself`);
    }
  });

  test('the bookmark tap says it is working, and says when the write did not take', () => {
    // The whole chain moved into the hero with the situation it saves (revamp
    // A), and none of it was allowed to get simpler on the way.
    const toggle = between(flat(HERO), 'const toggleBookmark', 'const open =', 'the hero has a bookmark toggle');
    assert.match(toggle, /if \(bookmarkWrite === 'writing'\) return;/, 'a second tap can queue a second write over the first');
    assert.ok(
      toggle.indexOf("setBookmarkWrite('writing')") < toggle.indexOf('setBookmark('),
      'the write starts before anything says so, so the mark is dead for two storage round-trips',
    );
    assert.match(
      toggle,
      /\.catch\(/,
      'a write that failed is swallowed, so the mark never changes and the learner taps a control that will never move',
    );
    assert.ok(
      toggle.indexOf('.then(') < toggle.indexOf('.catch('),
      'the rejection is handled before the answer is, so the chain reads backwards',
    );
    assert.doesNotMatch(
      toggle,
      /\}, \(\) => \{/,
      'the rejection is a second argument to .then, which cannot see a throw from the handler beside it',
    );
    assert.match(toggle, /\.then\(\(\) => loadBookmarks\(\)\)/, 'the hero assumes the write took instead of reading the store back');
    assert.match(toggle, /setBookmarkWrite\('refused'\)/, 'a write that failed leaves the mark claiming the shelf changed');
    assert.match(toggle, /setBookmarkWrite\('idle'\)/, 'the mark never goes back to reporting the store');
    assert.match(toggle, /setBookmark\(id, !isSaved\)/, 'the toggle writes something other than the opposite of what is on screen');

    // The busy state is the module's too: a card that worked out its own
    // disabled would be a second answer to when a control is off.
    assert.match(
      flat(HERO),
      /disabled=\{bookmark\.busy\}/,
      'the bookmark stays tappable while its own write is in flight, or decides for itself when it is off',
    );
    assert.match(
      flat(HERO),
      /import \{ bookmarkControl, bookmarkDecisions, isBookmarkedIn, type BookmarkWrite \} from '\.\.\/bookmarks\/view\.ts'/,
      'the card takes the bookmark as something other than the model the module decides',
    );
  });

  test('the saved list is folded once per read, not twice per render', () => {
    // `isBookmarked` walked every stored decision into a fresh Map to answer
    // one boolean, and the screen asked it twice in one render.
    assert.match(
      flat(HERO),
      /const decisions = useMemo\(\(\) => bookmarkDecisions\(bookmarks\), \[bookmarks\]\)/,
      'the hero rebuilds the whole decision store to answer one boolean, on every render',
    );
    assert.ok(!HERO.includes('isBookmarked('), 'the hero still asks the question that folds the store to answer it');
    assert.ok(!SCREEN.includes('bookmark'), 'Home is still carrying the bookmark chain the hero owns now');
  });

  test('a start that could not happen is answered on the card that asked, however it failed', () => {
    // `checking` disables the pill and the retry, so a probe that threw would
    // leave the learner in front of a dead primary control.
    const opener = between(flat(HERO), 'const open = ', 'return (', 'the card has an opener');
    assert.match(opener, /if \(checking\) return;/, 'a second tap while the probe is in flight can open a second room');
    assert.match(
      opener,
      /\.catch\(/,
      'the probe has one handler, so a rejection leaves the flag up and the one pill on Home disabled behind it',
    );
    assert.ok(
      opener.indexOf('.then(') < opener.indexOf('.catch('),
      'the rejection is handled before the answer is, so the chain reads backwards',
    );
    assert.doesNotMatch(
      opener,
      /\}, \(\) => \{/,
      'the rejection is a second argument to .then, which cannot see a throw from the handler beside it',
    );
    assert.equal(
      (opener.match(/setChecking\(false\)/g) ?? []).length,
      2,
      'the flag is let go of on one path only, so the other one leaves the card inert',
    );
    // And the start is kept, so the retry is the same start rather than a guess.
    assert.match(opener, /setHeldBack\(\{ textMode: false \}\)/, 'a start lost to a throw is dropped rather than kept for the retry');
  });
});
