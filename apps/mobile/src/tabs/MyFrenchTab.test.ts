/**
 * What My French is allowed to claim about a situation — F218. What it may
 * claim about a week is nothing: the story moved to Profile with F561, and
 * `profile/FrenchLifeCard.test.ts` holds the F233 importer count now.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. That is a blunt tool and its ceiling is honest: it proves the mark is
 * wired to `passport.ts` and to nothing else, never that a green dot appeared on
 * a phone. The class of bug it is pointed at is the one a renderer would not
 * catch either — a screen quietly growing a second opinion about independence,
 * next to a module that already has the only one.
 *
 * The whole slice is one sentence: a filled mark means the learner got through
 * that scene with nothing handed over. Every assertion here is that sentence
 * read backwards. `isStamped` chooses the fill, `signal.good` appears once in
 * the file so no other row can acquire one, and the state that has not happened
 * gets a hairline rather than a colour, on TodayRow's rule that a thing which
 * has not happened is not a state worth signalling.
 *
 * Both halves are needed. A test that only checks the green dot exists passes
 * just as happily on a screen that draws six of them.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { guiltIn } from '../copy/guilt.ts';

const read = (relative: string): string => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

/** Comments may say anything; only what reaches glass is under test. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const SCREEN = stripComments(read('./MyFrenchTab.tsx'));
const FLAT = SCREEN.replace(/\s+/g, ' ');

/**
 * The module the screen's judgements moved into.
 *
 * `myfrench/model.ts` folds every input this tab loads and hands back a value
 * with each decision already made. That is where the passport, the portfolio
 * and the chooser's words are consulted now, so the assertions below ask it
 * rather than the screen, and ask the screen to have stopped asking.
 */
const MODEL = stripComments(read('../myfrench/model.ts'));
const MODEL_FLAT = MODEL.replace(/\s+/g, ' ');

/**
 * The situation row, which is where the stamp is drawn now.
 *
 * F467 gave every row the colour of the place it happens in, and the row moved
 * into its own component to carry it. The stamp rules below moved with it
 * rather than being relaxed: "one green per surface that draws stamps" means
 * the same thing about this file that it used to mean about the screen.
 */
const ROW = stripComments(read('../myfrench/SituationRow.tsx'));

/** The words on a row's pill, and the words above the list. */
const SITUATION_COPY = stripComments(read('../myfrench/situations.ts'));

/**
 * The text between two markers, with both proven present.
 *
 * `surfaceContract.test.ts`'s `writtenBefore` guards the same trap for the same
 * reason: `indexOf` answers -1 for something that is not there, and a slice
 * taken from -1 is a slice of the wrong part of the file, so the assertions
 * that follow would be asked of text nobody wrote.
 */
function between(text: string, open: string, close: string, why: string): string {
  const from = text.indexOf(open);
  assert.notEqual(from, -1, `${why}; \`${open}\` is not there at all`);
  const to = text.indexOf(close, from + open.length);
  assert.notEqual(to, -1, `${why}; \`${close}\` is not there at all`);
  return text.slice(from, to);
}

/**
 * The situations list only, which is the part of this screen F218 owns.
 *
 * Scoped deliberately, but no longer because a count above it names
 * `independence`: F348 took the `Stat` rail out, and its own test now bans the
 * independence literals across the whole file. This slice stays narrow because
 * the next-situation card below it passes `next.independence` to `missionStatus`
 * — an expression, not a literal — and the F218 stamp checks (one green in the
 * slice, one stamp mark) want the situations list and nothing past it. It closes
 * at `st.nextSituation`, the card's own wrapper, because the pill block now sits
 * between the list and the chooser and closing on the chooser would swallow it.
 */
const SITUATIONS = stripComments(read('../myfrench/SituationsCard.tsx'));

/**
 * Every `<Tag ...>` in a body, whole, counting braces.
 *
 * The same walk `cardView.test.ts` writes, and for the same reason: a
 * `style={[st.a, cond ? st.b : st.c]}` carries no `>` but an `onPress` arrow
 * does, so a lazy regex stops early and reports the wrong text as the element.
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

/** The one element that draws a stamp, on one line so wrapping cannot hide it. */
function markTag(): string {
  const found = tags(ROW, 'View').filter((element) => element.includes('st.chip'));
  assert.equal(found.length, 1, `the row draws exactly one status pill, found ${found.length}`);
  return found[0]!.replace(/\s+/g, ' ');
}

/** One style rule from the sheet at the foot of the screen. */
function style(name: string): string {
  const source = ROW.includes(`${name}: {`) ? ROW : SCREEN;
  return between(source, `${name}: {`, '}', `${name} is a style this surface defines`);
}

/** Every quoted string in a body: the words a learner could end up reading. */
function literals(body: string): string[] {
  return body.match(/'[^']*'|"[^"]*"|`[^`]*`/g) ?? [];
}

describe('My French draws the stamps — F218', () => {
  test('the My French screen draws a stamp only for a scene finished unaided', () => {
    const mark = markTag();

    // The screen asks the module and takes the answer. A ternary on
    // `independence` here would be a second ladder, one screen from the first.
    assert.match(
      MODEL_FLAT,
      /import \{[^}]*stampsFrom[^}]*\} from '\.\.\/progress\/passport\.ts'/,
      'the model must consume stampsFrom rather than re-deriving the state',
    );
    assert.match(
      MODEL_FLAT,
      /earned: stamp !== undefined && isStamped\(stamp\)/,
      'the model must decide the fill with isStamped, so only on-your-own can earn one',
    );
    assert.ok(
      !SCREEN.includes('isStamped('),
      'the screen asks isStamped itself; that judgement moved into the model and must not be made twice',
    );
    // The mark is a filled pill with words in it now rather than a bare dot.
    // Same green, same claim, and still only for a scene finished unaided: the
    // chip reads its state off the passport's fold and never off a rung.
    assert.match(
      mark,
      /row\.chip\.earned \? st\.chipEarned : st\.chipQuiet/,
      'the fill must be read off the model rather than computed on the row',
    );
    assert.ok(!ROW.includes('isStamped('), 'the row asks isStamped itself; that judgement is the model\'s');
    assert.match(SITUATION_COPY, /stamp === 'on-your-own'/, 'the pill state is decided from something other than the passport fold');
    assert.ok(
      !/\.independence\b/.test(SITUATION_COPY),
      'the pill reads independence off the progress record; the passport already folded it and that fold is the only one',
    );
    assert.match(
      style('chipEarned'),
      /backgroundColor:\s*signal\.good/,
      'an earned pill is filled in the same green that means the learner produced French everywhere else',
    );

    // And the other half, which is where this would have gone wrong. A row that
    // has not happened is not a state, so it is never coloured as one.
    assert.match(
      style('chipQuiet'),
      /backgroundColor:\s*paper\.card/,
      'the waiting pill takes a colour; a thing that has not happened is not a state worth signalling',
    );

    // One green in the file means no other row can quietly acquire a stamp,
    // with-help included. This is the assertion that makes the word "only" true.
    assert.equal(
      (ROW.match(/signal\.good/g) ?? []).length,
      1,
      'signal.good is used more than once on the situation row, so something other than an earned pill can read as one',
    );
    // The heading's tick and the words beside it are one claim in two
    // properties, so the section carries exactly two and no more. A third would
    // be something other than "handled on your own" borrowing the same green.
    const sectionGreens = SITUATIONS.match(/signal\.good/g) ?? [];
    assert.equal(
      sectionGreens.length,
      2,
      `the situations section uses signal.good ${sectionGreens.length} times; it is the heading tick and its count, and nothing else`,
    );
    assert.match(
      SITUATIONS.replace(/\s+/g, ' '),
      /<BadgeGlyph size=\{16\} color=\{signal\.good\} \/> <Text style=\{\[type\.small, \{ color: signal\.good \}\]\}>\{model\.readyLine\}/,
      'the two greens in the section are not the tick and the count it belongs to',
    );
    assert.equal(
      (SCREEN.match(/signal\.good/g) ?? []).length,
      0,
      'the tab draws a green of its own again; the stamp is the row\'s and it is the only one',
    );

    for (const invented of ["'on-your-own'", "'with-help'", "'not-yet'"]) {
      assert.ok(
        !SITUATIONS.includes(invented) && !ROW.includes(invented),
        `the situations list names ${invented} itself; that judgement belongs in passport.ts`,
      );
    }
  });

  test('a stamp says what it is claiming, in the passport words', () => {
    const mark = markTag();

    // A green dot is not readable by everyone, and the row's own status line
    // answers a different question ("what next"), so the mark carries its own
    // name. stampLabel exists for exactly this and names the situation.
    // No image role: the pill says its state in words, so a second announcement
    // of the same thing would be read twice. The control carries the name.
    assert.doesNotMatch(mark, /accessibilityRole="image"/, 'the pill announces itself as an image as well as saying its state');
    // The pill is words, so it needs no separate image label. What the row owes
    // a screen reader is which situation it opens and what state it is in, and
    // that is one name on the control rather than two on its parts.
    assert.match(
      ROW.replace(/\s+/g, ' '),
      /accessibilityLabel=\{`\$\{row\.action\.accessibilityLabel\}\. \$\{row\.chip\.text\}\.`\}/,
      'the row does not name the situation and its state to a screen reader',
    );
    assert.match(
      MODEL_FLAT,
      /markLabel: stamp === undefined \? '' : stampLabel\(stamp\)/,
      'the model writes the mark sentence itself instead of borrowing stampLabel',
    );
  });

  test('no mark is drawn until one has been earned', () => {
    // hasStamps is the gate. A rail of empty marks is a quota, and a quota you
    // have not met is guilt wearing a different hat (progress/today.ts).
    assert.match(MODEL_FLAT, /hasStamps\(stamps\)/, 'nothing consults hasStamps, so the rail can draw empty');

    // The pill always draws, because it always says something true, and only
    // the earned one takes the green. The count above the list is what is held
    // back at zero: a tick beside nothing is the rail of empty marks again.
    assert.match(
      SITUATIONS,
      /model\.readyLine !== null &&/,
      'the count above the situations is drawn without waiting for one to be earned',
    );
    assert.match(SITUATION_COPY, /if \(earned <= 0\) return null;/, 'the count is written even when nothing has been earned');
  });

  test('a row adds no words a learner could read as a debt, and no count', () => {
    // The chip words only. `ownLine` is deliberately excluded and deliberately
    // does count: it is the heading's claim about the whole list, which
    // `progress/evidence.ts` already established this tab may make, and it is a
    // count with no denominator rather than a share. What must stay free of
    // numbers is the row, because a stamp is never a total.
    const said = [...literals(SITUATIONS), ...literals(ROW), ...literals(between(SITUATION_COPY, 'export const CHIP', '} as const;', 'the chip words'))];
    assert.ok(said.length > 4, `only ${said.length} strings found in the situations list, so this sweep proves little`);

    for (const line of said) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `the situations list says ${line}, which carries the banned word "${banned}"`);
      assert.doesNotMatch(line, /\d/, `the situations list says ${line}; a stamp is never a count, a share or a total`);
    }
  });
});

/* ===========================================================================
 * F348 — nothing at zero, and the next situation closes the screen.
 *
 * The three-`Stat` rail is gone: it was the one place on this screen that drew
 * a number with no module deciding whether it should be there at all. Every
 * count that remains sits behind the gate of the module that owns it —
 * `hasPhrases`, `hasStamps` — so a first-run learner meets an
 * honest empty screen rather than a rail of zeros. The rows read their verb
 * from `portfolio.ts`'s `situationAction`, and the screen closes on the next
 * situation from core, with the chooser demoted to the quiet door beneath it.
 * =========================================================================== */

/** Where a marker sits in the screen, proven present so ordering is real. */
function at(marker: string): number {
  const i = SCREEN.indexOf(marker);
  assert.notEqual(i, -1, `\`${marker}\` is not on the screen at all`);
  return i;
}

describe('My French draws nothing at zero and closes on the next situation — F348', () => {
  test('my french draws no count at zero: the stat rail is gone and every block waits on its module\'s gate', () => {
    // F348 removed a rail of three Stats that drew bare counts with no module
    // deciding whether they belonged. F366 brought three facts back behind a
    // gate: the only Stat on the screen is the one evidence.ts hands over,
    // inside hasEvidence, and nothing here can rehang a count outside it.
    assert.equal((SCREEN.match(/<Stat\b/g) ?? []).length, 1, 'My French draws a Stat outside the evidence row');
    assert.ok(!SCREEN.includes('st.stats'), 'the old stat rail style survives, so a count can still be rehung on it');
    assert.match(FLAT, /hasEvidence\(model\.evidence\) &&/, 'the evidence row is drawn without asking hasEvidence');

    // No count is drawn without its module's gate: the notebook waits on
    // hasPhrases the way the stamps wait on hasStamps. The week waited on
    // hasStory here until F561 moved it to Profile, where its own card holds
    // that gate now (profile/FrenchLifeCard.test.ts).
    assert.match(FLAT, /import \{[^}]*hasPhrases[^}]*\} from '\.\.\/phrases\/phrasebook\.ts'/, 'the notebook count has no gate to wait on');
    assert.match(FLAT, /hasPhrases\(model\.book\)/, 'the notebook is drawn without asking hasPhrases');
    assert.ok(!FLAT.includes('hasStory('), 'the week is drawn on My French again; it lives on Profile now (F561)');
    assert.match(MODEL_FLAT, /hasStamps\(stamps\)/, 'the stamps are drawn without asking hasStamps');

    // The screen names no independence literal anywhere now the rail is gone.
    // That judgement is the passport's, one module away, and naming it here is a
    // second ladder however it is dressed.
    for (const invented of ["'on-your-own'", "'with-help'", "'not-yet'"]) {
      assert.ok(!SCREEN.includes(invented), `My French names ${invented} itself; that judgement belongs in passport.ts`);
    }
    assert.ok(!SCREEN.includes('.independence ==='), 'My French compares independence directly, which is the passport\'s comparison to make');
  });

  test('my french draws its evidence from evidence.ts, inside its gate, and decides none of it on the screen — F366', () => {
    // Three facts at the head of the page, and every one of them decided one
    // module away. The screen loads the activity log, hands everything to
    // evidenceFrom, waits on hasEvidence, and maps the stats it is given. It
    // never counts, never filters missions itself, and never names a level.
    assert.match(
      FLAT,
      /import \{[^}]*evidenceFrom[^}]*hasEvidence[^}]*\} from '\.\.\/progress\/evidence\.ts'/,
      'My French does not read its evidence from evidence.ts',
    );
    assert.match(FLAT, /import \{[^}]*\bStat\b[^}]*\} from '\.\.\/components\.tsx'/, 'My French does not draw the Stat primitive');
    assert.match(FLAT, /loadActivity\(\)/, 'My French never reads the activity log, so it has no level to show');
    assert.match(FLAT, /evidenceFrom\(\{ missions: nextMissions, book: nextBook, activity \}\)/, 'the evidence is not built from the same reads the rest of the screen uses');

    // The row: gated, mapped, three to a row, and read as one summary.
    const row = between(SCREEN, 'hasEvidence(model.evidence) &&', 'hasSaved(model.saved)', 'the evidence row is not drawn at the head of the Spoken Map lane');
    assert.match(row, /model\.evidence\.stats\.map\(/, 'the row does not map the stats the module handed over');
    assert.match(row, /<Stat key=\{stat\.label\} value=\{stat\.value\} label=\{stat\.label\} columns=\{3\}/, 'a stat is not drawn three to a row from the module\'s own fields');
    assert.match(row, /accessibilityRole="summary"/, 'the row is not read as one summary');

    // The analytics event reads the same numbers, from the same module.
    assert.match(FLAT, /situationsDone: nextEvidence\.situations, linesKept: nextEvidence\.lines/, 'the analytics event counts for itself instead of reading evidence.ts');
    assert.ok(!SCREEN.includes('timesFinished > 0'), 'My French counts finished situations itself; that is evidence.ts\'s count');
    assert.ok(!SCREEN.includes('levelFor('), 'My French names a level itself; that is evidence.ts\'s to say');
  });

  test('my french closes on the next situation, and the chooser is the quiet door', () => {
    // Core picks the next situation, the same call Home makes; this screen draws
    // it and never re-derives which one.
    assert.match(FLAT, /import \{[^}]*suggestedMission[^}]*\} from '@luvani\/core'/, 'My French never imports suggestedMission');
    assert.match(FLAT, /suggestedMission\(nextMissions\)/, 'the next situation is not picked from the same list Home reads');

    // Exactly one primary pill, the next-situation start, named for the situation
    // it opens through startLabel so a screen reader hears which one.
    const pills = FLAT.match(/<PillButton label=\{NEXT_SITUATION\.action\} accessibilityLabel=\{startLabel\(/g) ?? [];
    assert.equal(pills.length, 1, `My French draws ${pills.length} next-situation pills; it draws exactly one`);

    // The chooser is the quiet door below it, and it is always reachable — drawn
    // outside the next-situation gate so a learner with no suggestion can still leave.
    assert.match(FLAT, /<GhostButton label="Choose another situation"/, 'the chooser is not the quiet ghost door');
    assert.ok(at('st.nextSituation') < at('Choose another situation'), 'the chooser sits above the next-situation card instead of closing beneath it');

    // Top to bottom, and the lanes are the order now. The Spoken Map runs
    // situations, the next-situation card; the Memory Deck follows with the
    // notebook; the chooser closes the page outside both. The week left for
    // Profile with F561.
    assert.ok(!SCREEN.includes('st.week'), 'the week block is back on My French; the story lives on Profile now (F561)');
    assert.ok(at('<SituationsCard') < at('st.nextSituation'), 'the situations list does not sit above the next-situation card');
    assert.ok(at('st.nextSituation') < at('Your notebook'), 'the Memory Deck lane does not follow the Spoken Map lane');
  });

  test('a finished situation\'s row says refine pronunciation in the module\'s words, and goes where the module says', () => {
    // The row asks the module for its verb and branches on kind. A finished
    // situation refines its sounds; an unfinished one is started. Neither word
    // is spelled here.
    assert.match(MODEL_FLAT, /situationAction\(progress\)/, 'the model does not read the row action from situationAction');
    assert.ok(!SCREEN.includes('situationAction('), 'the screen re-derives the row verb the model already chose');
    assert.match(SITUATIONS, /row\.action\.kind === 'refine'/, 'the section does not branch on the module\'s kind');

    // Refine goes to the sound check; start tracks the entry and opens the scene.
    assert.match(FLAT, /nav\.navigate\('SoundCheck', \{ missionId \}\)/, 'a refine row does not open the sound check');
    assert.match(ROW, /onPress=\{onPress\}/, 'the row wires its own navigation instead of taking it from the tab');
    assert.match(FLAT, /name: 'mission_started'/, 'a start row does not track the mission it opens');
    assert.match(FLAT, /entry: 'my-french'/, 'a start row does not carry its own entry point');
    assert.match(FLAT, /nav\.navigate\('Convo', \{ missionId \}\)/, 'a start row does not open the scene');

    // The old words left the file with the decision. "Check" and "Sound check
    // for" now live only in the module, so they cannot drift from it here.
    assert.ok(!SCREEN.includes("'Check'"), 'My French still spells the Check label itself');
    assert.ok(!SCREEN.includes('Sound check for'), 'My French still spells the sound-check sentence itself');
  });
});

/* ===========================================================================
 * F394 — the situations the learner saved, and nothing when they saved none.
 *
 * Home's daily situation card carries a Bookmark, and what it saves has to
 * arrive somewhere the learner can find it again. That somewhere is here,
 * beside the notebook and the scenes they have already walked into.
 *
 * Everything with a decision in it is `bookmarks/view.ts`: which situations are
 * saved, in which order, what the block is called and what the verb on a row
 * is. This screen asks and draws. The assertion with weight in it is the gate:
 * a shelf that says it is empty says the learner failed to fill it, which is
 * the rule `progress/evidence.ts` and `progress/today.ts` already hold.
 * =========================================================================== */

describe('My French carries the saved situations — F394', () => {
  test('my french draws saved situations inside hasSaved and starts one through the seed topic — F394', () => {
    // The fold is the module's, over the store's decisions and core's pool. A
    // screen that filtered the items itself would be a second opinion about
    // what "saved" means, one import away from the only one.
    const imported = FLAT.match(/import \{([^}]*)\} from '\.\.\/bookmarks\/view\.ts'/);
    assert.ok(imported, 'My French never imports the saved-situations view, so it has nothing to draw');
    for (const name of ['SAVED_SITUATIONS_LABEL', 'SAVED_SITUATION_ACTION', 'hasSaved', 'savedSituations']) {
      assert.ok(imported[1]!.includes(name), `My French imports the bookmarks view without ${name}`);
    }
    assert.match(FLAT, /loadBookmarks\(\)/, 'the screen never reads the bookmark store');
    assert.match(
      FLAT,
      /savedSituations\(bookmarks, DAILY_SCENARIOS\)/,
      "the saved list is not folded from the store against core's pool, so a retired id could draw a blank row",
    );
    for (const meddling of ['.sort(', '.filter(', '.reverse(', '.slice(']) {
      assert.ok(!SCREEN.includes(`saved${meddling}`), `the screen writes saved${meddling}; the list arrives ordered and is drawn as it arrives`);
    }

    // Nothing at zero. Not an empty state, not a hint, not a nudge to go and
    // save something: a learner who has saved nothing has not failed at
    // anything, and a panel telling them the shelf is empty says they have.
    const drawn = SCREEN.indexOf('<Label>{SAVED_SITUATIONS_LABEL}');
    assert.notEqual(drawn, -1, 'there is no saved block to gate');
    const gate = SCREEN.lastIndexOf('hasSaved(model.saved)', drawn);
    assert.notEqual(gate, -1, 'the saved block is drawn with nothing holding it back');
    assert.ok(drawn - gate < 160, 'the hasSaved gate is somewhere else on the screen, not on the block it is meant to hold back');

    // The block's own words are the module's, both of them.
    assert.match(SCREEN, /<Label>\{SAVED_SITUATIONS_LABEL\}<\/Label>/, 'the screen spells the saved heading itself');
    assert.ok(!SCREEN.includes("'Saved situations'"), 'the screen spells the saved heading itself');
    assert.ok(!SCREEN.includes('label="Start"'), 'the screen spells the saved verb itself');

    // A row says which situation it is, in English, and opens it as a
    // conversation through the same seed-topic pipe Home starts one with. No
    // mission id: a daily situation is not a mission and never claims to be.
    const saved = between(SCREEN, '<Label>{SAVED_SITUATIONS_LABEL}', '<SituationsCard', 'the saved shelf sits above the situations in the Spoken Map lane');
    assert.match(saved, /\{situation\.titleEn\}/, 'a saved row does not name the situation');
    assert.match(saved, /label=\{SAVED_SITUATION_ACTION\}/, 'a saved row does not read its verb from the module');
    assert.match(
      saved.replace(/\s+/g, ' '),
      /nav\.navigate\('Convo', \{ seedTopic: seedTopicOf\(situation\) \}\)/,
      'a saved row does not open the conversation on the scene it names',
    );
    assert.match(saved, /accessibilityLabel=\{startLabel\(situation\.titleEn\)\}/, 'a saved row leaves a screen reader with a bare verb');
    assert.doesNotMatch(saved, /<PillButton/, 'a saved row is drawn as a second primary; the tab has one pill and it is the next situation');

    // The row is reachable one handed, like every other row in the app.
    assert.match(style('savedRow'), /minHeight: HIT/, 'a saved row falls under the touch floor');

    // And the block adds no words a learner could read as a debt, and no count.
    const said = literals(saved);
    for (const line of said) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `the saved block says ${line}, which carries the banned word "${banned}"`);
      assert.doesNotMatch(line, /\d/, `the saved block says ${line}; a shelf of saved scenes is never a count`);
    }
  });
});

/* ===========================================================================
 * F463 — the evidence ledger: two lanes, one line, and a screen that decides
 * nothing.
 *
 * The redesign's whole claim is that My French is a different job from
 * Practice: its unit is the phrase rather than the session, and the page is the
 * evidence ladder rendered as a layout rather than as a bar. That claim is only
 * as good as the separation underneath it, so most of what follows is about
 * what this screen must no longer be able to work out for itself.
 *
 * The pill count is the part worth reading twice. The tab draws two primaries
 * across two files and renders exactly one, and `myfrench/primary.ts` is the
 * only thing that knows which. Because the one-line card is its own component,
 * each file still holds exactly one `<PillButton` and the surface contract's
 * count did not have to move.
 * =========================================================================== */

const ONE_LINE = stripComments(read('../myfrench/OneLineCard.tsx'));

describe('My French is the evidence ledger — F463', () => {
  test('the screen works nothing out for itself', () => {
    // Every one of these is a judgement owned by a module. The screen used to
    // make two of them and there is no renderer here to catch the day it makes
    // a third, so the ban is on the source.
    for (const derived of [
      'evidenceStateOf(',
      'isRetained(',
      'firstReturn(',
      'retainedOrder(',
      '.convoUses',
      '.transfers',
      'isStamped(',
      'situationAction(',
      'levelFor(',
      'timesFinished > 0',
      '.independence ===',
    ]) {
      assert.ok(!SCREEN.includes(derived), `My French works out ${derived} itself; that judgement belongs in a module`);
    }
  });

  test('the sound line left the screen, where nothing could test it', () => {
    // It used to be two functions at the top of this file deciding learner
    // facing copy, which is the one shape a source walk cannot check.
    assert.ok(!SCREEN.includes('function checkLine'), 'the sound line is decided on the screen again');
    assert.ok(!SCREEN.includes('function latestCheck'), 'the latest check is picked on the screen again');
    assert.match(
      stripComments(read('../myfrench/model.ts')).replace(/\s+/g, ' '),
      /soundLine\(latestCheck\(/,
      'the model does not read the sound line from myfrench/sounds.ts',
    );
  });

  test('the tab deals one line, and never a second', () => {
    // A queue on this tab would make it the review sitting with a different
    // header. There is one card, and no way to ask for another.
    assert.match(FLAT, /<OneLineCard line=\{model\.oneLine\}/, 'the tab never draws the one-line card');
    assert.equal((SCREEN.match(/<OneLineCard\b/g) ?? []).length, 1, 'the tab draws more than one line');
    for (const sitting of ['dueCards(', 'sittingView(', 'DUE_CAP']) {
      assert.ok(!SCREEN.includes(sitting), `My French reaches for ${sitting}; a queue here is the sitting Practice already owns`);
      assert.ok(!ONE_LINE.includes(sitting), `the one-line card reaches for ${sitting}, which makes it a sitting`);
    }
  });

  test('the one line borrows the reveal gate rather than keeping a second copy', () => {
    // The whole claim of the deck is that a good grade followed a real attempt.
    // A second reveal rule one file away is how one surface starts handing out
    // the French for a keystroke while the other still asks for it.
    assert.match(ONE_LINE, /import \{[\s\S]*?cardView[\s\S]*?\} from '\.\.\/review\/cardView\.ts'/, 'the one-line card does not use cardView');
    assert.match(ONE_LINE, /gradeCard\(line\.card\.id/, 'the one-line card does not grade through the deck store');
    assert.ok(!ONE_LINE.includes('applyGrade('), 'the one-line card schedules for itself instead of through the store');
    // And no microphone: this page listens to nothing.
    for (const mic of ['SpeakCircle', 'expo-audio', 'Recording']) {
      assert.ok(!ONE_LINE.includes(mic), `the one-line card reaches for ${mic}; nothing on this page records`);
    }
  });

  test('exactly one primary renders, and one module decides which', () => {
    // Two branches, two files, one on screen. The mutual exclusion itself is
    // held in myfrench/primary.test.ts; this is the wiring half.
    assert.match(FLAT, /const primary = primaryFor\(model\)/, 'the screen never asks which primary to draw');
    assert.match(FLAT, /\{primary\?\.kind === 'situation' && model\.next !== null && \(/, 'the next-situation card is not gated on the primary');
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 1, 'My French draws more than one pill in its own file');
    assert.equal((ONE_LINE.match(/<PillButton\b/g) ?? []).length, 1, 'the one-line card draws more than one pill');
  });

  test('the switch says the founder’s two words and is absent when a lane is empty', () => {
    assert.match(FLAT, /<TabBar tabs=\{LANES\} active=\{showing\} onChange=\{setLane\} accessibilityLabel=\{LANES_LABEL\}/, 'the lanes are not drawn with the shared segmented control');
    assert.match(FLAT, /\{lanes && \(/, 'the switch is drawn without asking showLanes');
    assert.match(FLAT, /const lanes = showLanes\(model\)/, 'the screen decides for itself whether to draw the switch');
    assert.match(FLAT, /lane \?\? openingLane\(model\)/, 'the screen picks its own opening lane');
    // The words themselves are the module's, so the tab cannot rename them.
    assert.ok(!SCREEN.includes("'Spoken Map'"), 'the screen spells the lane labels itself');
    assert.ok(!SCREEN.includes("'Memory Deck'"), 'the screen spells the lane labels itself');
  });

  test('a learner with nothing meets one sentence and one door, not a page of headings', () => {
    assert.match(FLAT, /\{!hasMyFrench\(model\) && \(/, 'the opening card is drawn without asking the model');
    assert.match(FLAT, /\{OPENING\.title\}/, 'the opening card spells its own words');
    assert.match(FLAT, /<OutlineButton label=\{OPENING\.action\}/, 'the opening door is a second primary rather than the quiet one');
  });

  test('every word this screen still spells is clean', () => {
    const said = SCREEN.match(/'[^']*'|"[^"]*"/g) ?? [];
    for (const line of said) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `My French says ${line}, which carries the banned word "${banned}"`);
    }
    assert.ok(!SCREEN.includes('—'), 'My French carries an em dash into learner-facing copy');
  });
});

/* ===========================================================================
 * F470 — My French speaks, and stops.
 *
 * The tab had no audio at all until the founder's mockup asked for the play
 * button beside the retained expression and a Listen on each half of a minimal
 * pair. `tutorVoice.speak` is free and offline and needed no new plumbing, but
 * it calls `Speech.stop()` before it starts and nothing calls it afterwards, so
 * a voice started here follows the learner onto whatever they open next. That
 * is F304, already recorded against the tutor-voice sampler in Profile, and
 * these are the assertions that stop this tab repeating it.
 * =========================================================================== */

describe('My French speaks, and stops — F470', () => {
  /** Every component under myfrench/ that can start a voice. */
  const SPEAKERS = ['OneLineCard.tsx', 'LedgerLane.tsx', 'AcousticCard.tsx', 'CadenceCard.tsx', 'SituationRow.tsx'];

  test('anything that starts a voice also stops one when it goes', () => {
    for (const name of SPEAKERS) {
      const body = stripComments(read(`../myfrench/${name}`));
      if (!body.includes('tutorVoice.speak(')) continue;
      assert.match(
        body.replace(/\s+/g, ' '),
        /useEffect\(\(\) => \(\) => tutorVoice\.stop\(\), \[\]\)/,
        `${name} starts a voice and never stops it; it will follow the learner off this tab`,
      );
    }
  });

  test('at least one of them does speak, so the sweep above is not vacuous', () => {
    const speaking = SPEAKERS.filter((name) => stripComments(read(`../myfrench/${name}`)).includes('tutorVoice.speak('));
    assert.ok(speaking.length >= 3, `only ${speaking.length} components speak, so the tab lost its audio`);
  });

  test('every control that plays says what it will play', () => {
    // "Listen" alone names nothing to a learner who cannot see which word it
    // sits under, so the accessible label carries the word itself.
    for (const name of SPEAKERS) {
      const body = stripComments(read(`../myfrench/${name}`));
      const plays = (body.match(/tutorVoice\.speak\(/g) ?? []).length;
      if (plays === 0) continue;
      const labelled = (body.match(/accessibilityLabel=\{`Hear /g) ?? []).length;
      assert.equal(labelled, plays, `${name} plays ${plays} things and labels ${labelled} of them`);
    }
  });

  test('nothing here listens, records or scores', () => {
    // Every Listen on this tab is playback. The tab takes no microphone.
    for (const name of SPEAKERS) {
      const body = stripComments(read(`../myfrench/${name}`));
      for (const listening of ['useAudioRecorder', 'SpeakCircle', 'scoreRecordedAttempt', 'consumeRecording']) {
        assert.ok(!body.includes(listening), `${name} reaches for ${listening}; nothing on this tab records`);
      }
    }
  });
});
