/**
 * My French, as revamp A left it: one page of doors and nothing to fail.
 *
 * There is no renderer in this suite (docs/TESTING.md), so this reads the
 * screen. That is a blunt tool and its ceiling is honest: it proves the rows
 * are wired to `passport.ts` and to nothing else, never that a tinted row
 * appeared on a phone. The class of bug it is pointed at is the one a renderer
 * would not catch either — a screen quietly growing a second opinion about
 * independence, next to a module that already has the only one.
 *
 * What the tab used to be is worth saying, because half of what follows is a
 * ban on it coming back. It was a segmented switch over two readings of one
 * body of evidence, a card that dealt a line to grade, a rail of three counts,
 * a sound panel, a next-situation card with a pill on it, a notebook card and a
 * ghost door at the foot. Every one of those was true and most of them were one
 * tap from somewhere better. The phrases went to the Phrasebook, the sound to
 * the sound check, the packs to Conversations, and the suggestion folded into
 * the first row under "Next places".
 *
 * The rule that survived all of it unchanged: a filled chip means the learner
 * got through that scene with nothing handed over. `isStamped` chooses the
 * fill, `signal.good` appears once so no other row can acquire one, and a state
 * that has not happened gets no colour at all.
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { missionStates } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { myFrenchFrom } from '../myfrench/model.ts';
import { MY_FRENCH_COPY } from '../myfrench/copy.ts';

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

/** The rows, which is where the tint, the mark and the chip are drawn. */
const ROWS = stripComments(read('../myfrench/SituationsCard.tsx'));
const ROWS_FLAT = ROWS.replace(/\s+/g, ' ');

/** The words above the rows, and the words on a chip. */
const SITUATION_COPY = stripComments(read('../myfrench/situations.ts'));

const NOW = Date.parse('2026-09-07T09:00:00Z');
const MISSIONS = missionStates([], [], NOW);

/**
 * Every `<Tag ...>` in a body, whole, counting braces.
 *
 * The same walk `cardView.test.ts` writes, and for the same reason: a
 * `glyph={<QuoteGlyph color={accent.primary} />}` carries a `/>` of its own, so
 * a lazy regex stops inside the prop and reports half an element as the whole.
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

describe('My French is the places, the shelf and the way back — F575', () => {
  test('my french draws one tinted row per mission, stamped ones first, and no count', () => {
    // One row per situation in the catalogue, and the model is what counts them.
    const model = myFrenchFrom({ deck: [], missions: MISSIONS, saved: [], packs: [], suggested: null, now: NOW });
    assert.equal(model.situations.length, MISSIONS.length, 'a place in the catalogue has no row');
    assert.ok(MISSIONS.length > 1, 'the catalogue is too small for this to prove anything');

    // Drawn as the shared tinted row, once, with the place's own paper and the
    // place's own mark. A row that picked its colour here would be a second
    // opinion one file from missionTint's.
    assert.equal((ROWS.match(/<TintRow\b/g) ?? []).length, 1, 'the situations are drawn as more than one kind of row');
    assert.match(ROWS_FLAT, /tint=\{row\.tint\}/, 'a row picks its own colour instead of taking the place\'s');
    assert.match(ROWS_FLAT, /glyph=\{<PlaceGlyph place=\{row\.place\} color=\{accent\.primary\} \/>\}/, 'a row draws something other than its place\'s mark');
    assert.match(ROWS_FLAT, /title=\{row\.title\} gloss=\{row\.gloss\}/, 'a row does not carry the French name over the English one');
    assert.match(ROWS_FLAT, /accessibilityLabel=\{row\.accessibilityLabel\}/, 'a row leaves a screen reader to read three unrelated nodes');

    // Stamped first, and the split is the module's.
    assert.match(ROWS_FLAT, /const \{ own, next \} = splitByStamp\(model\.situations, model\.suggestedId\)/, 'the rows are split on the screen');
    assert.ok(ROWS.indexOf('{own.length > 0 &&') < ROWS.indexOf('{next.length > 0 &&'), 'the places already theirs do not lead the page');
    assert.match(MODEL_FLAT, /import \{[^}]*stampsFrom[^}]*\} from '\.\.\/progress\/passport\.ts'/, 'the model must consume stampsFrom rather than re-deriving the state');
    assert.match(MODEL_FLAT, /earned: stamp !== undefined && isStamped\(stamp\)/, 'the model must decide the fill with isStamped, so only on-your-own can earn one');
    assert.ok(!SCREEN.includes('isStamped(') && !ROWS.includes('isStamped('), 'the fill is decided twice, one file from the passport');

    // The chip is the mark, and its green is the only one in the file, so no
    // other state can quietly acquire the claim that green makes.
    assert.equal((ROWS.match(/signal\.good/g) ?? []).length, 1, 'something other than an earned chip reads as one');
    assert.match(ROWS_FLAT, /chip\.earned \? st\.chipEarned : st\.chipQuiet/, 'the fill is computed on the row rather than read off the model');
    assert.match(ROWS, /chipEarned: \{ backgroundColor: signal\.good \}/, 'an earned chip is not filled in the green that means the learner produced French');
    assert.match(ROWS, /chipQuiet: \{ backgroundColor: paper\.card \}/, 'a state that has not happened took a colour');
    assert.equal((SCREEN.match(/signal\.good/g) ?? []).length, 0, 'the tab draws a green of its own; the chip is the row\'s and it is the only one');

    // And no count. The rail of three Stats went with F348 and the tally beside
    // the heading went with revamp A: the rows are the record, and a number
    // over a page of places is the one thing on it that could read as a score.
    assert.ok(!SCREEN.includes('<Stat'), 'a count came back to My French');
    assert.ok(!SITUATION_COPY.includes('ownLine'), 'the tally above the situations came back');
    assert.ok(!ROWS.includes('readyLine') && !SCREEN.includes('readyLine'), 'the tally above the situations is drawn again');
    for (const line of [...literals(ROWS), ...literals(SCREEN)]) {
      assert.doesNotMatch(line, /\d/, `My French says ${line}; a page of places is never a count, a share or a total`);
    }
    for (const invented of ["'on-your-own'", "'with-help'", "'not-yet'"]) {
      assert.ok(!SCREEN.includes(invented) && !ROWS.includes(invented), `the tab names ${invented} itself; that judgement belongs in passport.ts`);
    }
  });

  test('the phrase shelf opens the phrasebook and the one-line card lives there', () => {
    // One line of French, and the whole phrasebook behind it. The row always
    // draws: on an empty deck the module's own sentence says what the shelf is
    // for, which is a different thing from telling a learner they kept nothing.
    assert.match(FLAT, /<IconRowCard glyph=\{<QuoteGlyph color=\{accent\.primary\} \/>\} label=\{SHELF_LABEL\} line=\{model\.shelf\}/, 'the shelf is not the white row card with the quote mark on it');
    assert.match(FLAT, /accessibilityLabel=\{SHELF_OPEN\} onPress=\{\(\) => nav\.navigate\('Phrasebook'\)\}/, 'the shelf does not open the phrasebook, or opens it without saying so');
    assert.ok(!SCREEN.includes('setShowingPhrases'), 'the phrasebook is still an early return inside the tab rather than a route');

    // The card that asks for a line moved with the phrases. A tab whose first
    // card is a thing to get right is a tab with a task on it, and this one has
    // none: every row here is a door.
    assert.ok(!SCREEN.includes('<OneLineCard'), 'the one-line card is drawn on My French again');
    const phrasebook = stripComments(read('../phrases/PhrasebookScreen.tsx'));
    assert.ok(phrasebook.includes('<OneLineCard'), 'the one-line card left My French and did not arrive in the Phrasebook');
  });

  test('a learner meets a page of doors and no task, so there is nothing on it to fail', () => {
    // No primary pill at all. Every other tab draws one because it is asking
    // for something; this one is a record, and a record does not ask.
    assert.equal((SCREEN.match(/<PillButton\b/g) ?? []).length, 0, 'My French draws a primary pill; this page asks for nothing');
    assert.ok(!SCREEN.includes('<GhostButton'), 'the ghost chooser came back; the rows are the chooser now');
    assert.ok(!SCREEN.includes('<OutlineButton'), 'the tab grew a second door beside its rows');
    assert.ok(!SCREEN.includes('primaryFor('), 'the tab still asks which primary to draw, and it draws none');

    // And nothing that reports a state as a score.
    assert.ok(!/\bprogressBar|<Bar\b|percent/i.test(SCREEN), 'a bar or a percentage reached the page');
  });

  test('every judgement this screen used to make now lives in a module', () => {
    // Every one of these is a judgement owned by a module. The screen used to
    // make two of them and there is no renderer here to catch the day it makes
    // a third, so the ban is on the source.
    for (const derived of [
      'evidenceStateOf(',
      'isRetained(',
      'retainedOrder(',
      '.convoUses',
      '.transfers',
      'isStamped(',
      'situationAction(',
      'levelFor(',
      'timesFinished > 0',
      '.independence ===',
      'missionTint(',
      'ledgerFrom(',
    ]) {
      assert.ok(!SCREEN.includes(derived), `My French works out ${derived} itself; that judgement belongs in a module`);
    }
    assert.match(FLAT, /const model: MyFrench = myFrenchFrom\(\{/, 'the screen no longer folds its inputs through the model');
    assert.ok(!SCREEN.includes('function checkLine'), 'the sound line is decided on the screen again');
    assert.ok(!SCREEN.includes('function latestCheck'), 'the latest check is picked on the screen again');
  });

  test('the sections the tab lost cannot be rehung on it', () => {
    // Each of these was a real section and each of them is now somewhere a
    // learner can reach in one tap. What must not happen is a second copy here.
    for (const gone of ['<TabBar', 'LANES', 'showLanes(', 'openingLane(', 'OPENING.', '<AcousticCard', '<CadenceCard', '<LedgerLane', '<NextSituationCard', 'ConversationPackLibrary', 'hasMyFrench(', 'hasPhrases(', 'Your notebook']) {
      assert.ok(!SCREEN.includes(gone), `${gone} is drawn on My French again; revamp A moved it somewhere a learner can reach in one tap`);
    }
    // The two early returns went with them: a screen inside a tab has no way
    // back that the system's own gesture understands.
    assert.ok(!SCREEN.includes('if (showingPhrases)') && !SCREEN.includes('if (showingPacks)'), 'a whole screen is still returned from inside the tab');
  });

  test('the saved situations arrive only when the learner saved one, and open the scene they name', () => {
    // Nothing at zero. Not an empty state, not a hint, not a nudge to go and
    // save something: a learner who has saved nothing has not failed at
    // anything, and a panel telling them the shelf is empty says they have.
    const drawn = SCREEN.indexOf('<Label>{SAVED_LABEL}');
    assert.notEqual(drawn, -1, 'there is no saved block to gate');
    const gate = SCREEN.lastIndexOf('model.showSaved &&', drawn);
    assert.notEqual(gate, -1, 'the saved block is drawn with nothing holding it back');
    assert.ok(drawn - gate < 160, 'the gate is somewhere else on the screen, not on the block it is meant to hold back');
    assert.match(MODEL_FLAT, /showSaved: hasSaved\(input\.saved\)/, 'the model decides for itself what "saved" means');

    // A saved scene is a row like any other place, and it opens as a
    // conversation through the same seed topic Home starts one with. No mission
    // id: a daily situation is not a mission and never claims to be.
    assert.match(FLAT, /nav\.navigate\('Convo', \{ seedTopic: seedTopicOf\(row\.scenario\) \}\)/, 'a saved row does not open the conversation on the scene it names');
    assert.match(FLAT, /savedSituations\(bookmarks, DAILY_SCENARIOS\)/, "the saved list is not folded from the store against core's pool, so a retired id could draw a blank row");
    for (const meddling of ['.sort(', '.filter(', '.reverse(', '.slice(']) {
      assert.ok(!SCREEN.includes(`saved${meddling}`), `the screen writes saved${meddling}; the list arrives ordered and is drawn as it arrives`);
    }
  });

  test('recent conversations lead the page, each opening its own conversation, from recorded evidence only', () => {
    // Prominent: above the situations, straight under the header and the one
    // progress sentence. Headed "Your conversations" since whole-app phase 2,
    // because the group and the door at its foot are one thing now.
    assert.ok(SCREEN.indexOf('<Label>{CONVERSATIONS_ROW}</Label>') > 0, 'there is no conversations block');
    assert.ok(SCREEN.indexOf('<Label>{CONVERSATIONS_ROW}</Label>') < SCREEN.indexOf('<SituationsCard'), 'the conversations sit below the situations');
    // Each row names itself whole, title, French preview and outcome, from
    // the model rather than a template on the screen.
    assert.match(
      FLAT,
      /label=\{row\.pack\.title\.en\} line=\{row\.preview\.join\(' · '\)\} note=\{row\.line\} accessibilityLabel=\{row\.accessibilityLabel\}/,
      'a recent row reads a partial label to a screen reader, or builds it on the screen',
    );
    // The places carry the page's block gap, so their heading never touches the
    // last recent card (seen in the browser at 390 wide before this held).
    assert.match(FLAT, /<View style=\{st\.block\}> <SituationsCard/, 'the places sit flush against the recent conversations');
    // Each row opens the conversation it names, not the whole library.
    assert.match(FLAT, /nav\.navigate\('Conversations', \{ packId: row\.pack\.id \}\)/, 'a recent row opens something other than its own conversation');
    // Every line comes from the model, and the model reads history, not guesses.
    assert.match(FLAT, /const recent = recentConversations\(\{ packs, events: history \}\)/);
    // Fable review (whole-app phase 2): the sentence reads every ready
    // conversation, not only the three rows drawn.
    assert.match(FLAT, /const progress = progressStatement\(allConversations\(\{ packs, events: history \}\)\)/);
    assert.match(FLAT, /\{progress !== null && /, 'the progress sentence is drawn with nothing behind it');
    // The recorded history and the old marks as their reader-only view, and
    // nothing else: no events are made up on this screen.
    assert.match(FLAT, /setHistory\(sameAccount\(\) \? \[\.\.\.events, \.\.\.legacyMarkItems\(marks\)\] : \[\]\)/, 'My French reads something other than the recorded history, or draws it for a changed account');
    // Bound to the account before the reads, checked after every one: a switch
    // or deletion mid-load never draws the previous account's packs or history.
    assert.match(FLAT, /const scope = scopeGeneration\(\); const sameAccount = \(\): boolean => !cancelled && scopeGeneration\(\) === scope;/);
    assert.match(FLAT, /loadConversationPacks\(\)\.then\(\(stored\) => \{ if \(sameAccount\(\)\) setPacks\(stored\);/, 'the cached packs are drawn for a changed account');
    assert.match(FLAT, /if \(sameAccount\(\) && result\.ok\) setPacks\(result\.packs\)/, 'refreshed packs are drawn for a changed account');
    assert.match(FLAT, /Promise\.all\(\[loadPracticeHistory\(\), loadPackMarks\(\)\]\)/);
    assert.match(FLAT, /\.catch\(\(\) => \{ if \(!cancelled\) setHistory\(\[\]\); \}\)/, 'an unreadable history leaves stale or invented outcomes on screen');
    assert.ok(!/kind: 'session-completed'|kind: 'recalled'/.test(SCREEN), 'the screen writes an event shape of its own');
    for (const claim of ['Used while speaking', 'mastered', 'fluent', 'CEFR']) {
      assert.ok(!SCREEN.includes(claim), `My French claims ${claim}`);
    }
  });

  test('the conversations group and its one See all appear only once there is a conversation to go back to', () => {
    // One heading, up to three recent rows, and one door into the whole
    // library. The group is gated as a whole, so a learner with no
    // conversation meets neither an empty heading nor an empty library.
    const heading = SCREEN.indexOf('<Label>{CONVERSATIONS_ROW}</Label>');
    assert.notEqual(heading, -1, 'there is no conversations heading to gate');
    const gate = SCREEN.lastIndexOf('model.showConversations &&', heading);
    assert.notEqual(gate, -1, 'a learner with no conversations is offered an empty library');
    assert.ok(heading - gate < 120, 'the gate is somewhere else on the screen, not on the group it is meant to hold back');

    // Exactly one See all, after the rows, into the library with no pack named.
    assert.equal((SCREEN.match(/label=\{RECENT_ALL\}/g) ?? []).length, 1, 'the library has more than one door, or none');
    assert.ok(SCREEN.indexOf('recent.map(') < SCREEN.indexOf('label={RECENT_ALL}'), 'See all sits above the rows it gathers');
    assert.match(FLAT, /label=\{RECENT_ALL\} line=\{CONVERSATIONS_SUB\}/, 'See all does not say what is behind it');
    // Browser proof: with the saved-conversation document glyph, See all read
    // as one more saved conversation. The library door carries the chat mark.
    assert.match(FLAT, /glyph=\{<ChatGlyph color=\{accent\.primary\} \/>\} label=\{RECENT_ALL\}/, 'See all looks like one more saved conversation');
    assert.match(FLAT, /accessibilityLabel=\{RECENT_ALL\} onPress=\{\(\) => nav\.navigate\('Conversations'\)\}/, 'See all opens something other than the whole library');
    // The row list is capped by the model, never sliced on the screen.
    assert.ok(!/recent\.slice\(/.test(SCREEN), 'the screen caps the recent rows itself');
  });

  test('the collection sits in the first useful scroll, above every situation — whole-app phase 2', () => {
    // The phrasebook and the daily collection used to be reached only after
    // every mission in the catalogue. They are the learner's own material, so
    // they come straight after the conversations it was made from.
    assert.ok(at('<Label>{COLLECTION_LABEL}</Label>') < at('<SituationsCard'), 'the collection is below the situations again');
    assert.ok(at('<Label>{COLLECTION_LABEL}</Label>') < at('label={SHELF_LABEL}'), 'the shelf is outside its collection');
    assert.ok(at('label={SHELF_LABEL}') < at('label={DAILY_LABEL}'), 'the daily collection comes before the learner\'s own phrases');
    assert.ok(at('label={DAILY_LABEL}') < at('<SituationsCard'), 'the daily collection is below the situations');
    // Its words are the copy module's, like every other door here.
    assert.match(FLAT, /label=\{DAILY_LABEL\} line=\{DAILY_LINE\} accessibilityLabel=\{DAILY_OPEN\} onPress=\{\(\) => nav\.navigate\('DailyLibrary'\)\}/, 'the daily collection spells its own words or opens somewhere else');
    assert.ok(!SCREEN.includes('"Daily collection"') && !SCREEN.includes('"Open daily collection"'), 'the daily collection is spelled on the screen again');
  });

  test('the portfolio suggests at most two next places, and the catalogue is one door away in Missions — whole-app phase 2', () => {
    // The whole catalogue under "Next places" was the one list on this page a
    // learner had to scroll past to reach their own phrases. The suggestion is
    // decided in situations.ts; the card draws what it is given.
    assert.match(ROWS_FLAT, /\{next\.length > 0 && \(/, 'the next group draws with nothing in it');
    assert.match(ROWS_FLAT, /\{tryNext\(next\)\.map\(\(row\) =>/, 'the card draws every next place instead of the capped suggestion');
    assert.ok(!/next\.slice\(/.test(ROWS), 'the card caps the list itself instead of asking situations.ts');
    // Browse is a row like every other door, after the places, into Missions.
    assert.ok(at('<SituationsCard') < at('label={BROWSE_LABEL}'), 'the way to every situation sits above the suggestions');
    assert.match(FLAT, /label=\{BROWSE_LABEL\} line=\{BROWSE_LINE\} accessibilityLabel=\{BROWSE_OPEN\} onPress=\{\(\) => nav\.navigate\('Missions'\)\}/, 'Browse situations does not open the full catalogue');
  });

  test('a finished place refines its sounds, and a new one opens the scene, in the module’s words', () => {
    // The row asks the module for its verb and branches on kind. A finished
    // situation refines its sounds; an unfinished one is started. Neither word
    // is spelled here.
    assert.match(MODEL_FLAT, /situationAction\(progress\)/, 'the model does not read the row action from situationAction');
    assert.match(ROWS, /row\.action\.kind === 'refine'/, 'the rows do not branch on the module\'s kind');
    assert.match(FLAT, /nav\.navigate\('SoundCheck', \{ missionId \}\)/, 'a refine row does not open the sound check');
    assert.match(FLAT, /name: 'mission_started'/, 'a start row does not track the mission it opens');
    assert.match(FLAT, /entry: 'my-french'/, 'a start row does not carry its own entry point');
    assert.match(FLAT, /nav\.navigate\('Convo', \{ missionId \}\)/, 'a start row does not open the scene');
    assert.ok(!SCREEN.includes("'Check'"), 'My French still spells the Check label itself');
    assert.ok(!SCREEN.includes('Sound check for'), 'My French still spells the sound-check sentence itself');
  });

  test('the sound fingerprint appears only from measured evidence and reopens its measured scene', () => {
    // The screen reads the store and hands the whole list to the pure sound
    // projection. It never branches on evidence kinds itself, which is what
    // prevents a self-guided attempt from becoming a pronunciation claim.
    assert.match(FLAT, /loadSoundChecks\(\)/, 'the tab never reads measured sound evidence');
    assert.match(FLAT, /const fingerprint = soundFingerprint\(checks\)/, 'the tab decides for itself what counts as measured');
    for (const kind of ["'assessed-focus'", "'assessed-clear'", "'self-guided'", "'unavailable'"]) {
      assert.ok(!SCREEN.includes(kind), `the tab branches on ${kind}; measured evidence belongs to sounds.ts`);
    }

    // Null means no row at all. When evidence exists, the compact white row
    // shows the waveform mark and returns to the exact situation measured.
    const drawn = SCREEN.indexOf('label={SOUND_FINGERPRINT_LABEL}');
    assert.notEqual(drawn, -1, 'the measured-sound affordance is missing');
    const gate = SCREEN.lastIndexOf('fingerprint !== null &&', drawn);
    assert.notEqual(gate, -1, 'an unmeasured learner is shown a sound fingerprint');
    assert.ok(drawn - gate < 260, 'the measured-evidence gate is not attached to the row it protects');
    assert.match(FLAT, /glyph=\{<WaveformGlyph color=\{accent\.primary\} \/>\}/, 'the sound door has no voice mark');
    assert.match(FLAT, /line=\{fingerprint\.line\}/, 'the sound door writes a claim instead of drawing the projection');
    // Stage 4 (2026-09-25): the name comes from `soundDoorLabel`, which answers
    // SOUND_FINGERPRINT_OPEN when there is no journey (journey.test.ts pins it).
    assert.match(FLAT, /accessibilityLabel=\{soundDoorLabel\(journey\)\}/, 'the sound door names nothing to a screen reader');
    // Stage 4 (2026-09-25): the same row opens the focused sound journey when
    // there is one. With no journey the door is exactly what it was: the sound
    // check for the situation the fingerprint shows.
    assert.match(
      FLAT,
      /journey !== null \? nav\.navigate\('SoundJourney'\) : nav\.navigate\('SoundCheck', \{ missionId: fingerprint\.missionId \}\)/,
      'the fingerprint does not reopen the situation whose evidence it shows, or the journey never opens',
    );
  });

  test('the sound row opens the journey only when journey.ts says there is one — Stage 4', () => {
    assert.match(FLAT, /const journey = soundJourney\(checks, Date\.now\(\)\)/, 'the tab decides for itself when there is a journey');
    assert.match(FLAT, /accessibilityLabel=\{soundDoorLabel\(journey\)\}/, 'the row names a place other than the one it opens');
    assert.doesNotMatch(FLAT, /accessibilityLabel=\{SOUND_FINGERPRINT_OPEN\}/, 'the row always says it opens the check');
    // The journey adds no row of its own: the fingerprint is the one door.
    assert.equal((SCREEN.match(/SOUND_FINGERPRINT_LABEL\}/g) ?? []).length, 1);
    assert.equal((SCREEN.match(/navigate\('SoundJourney'/g) ?? []).length, 1);
  });

  test('the header carries its own picture, and the picture never takes a tap', () => {
    assert.match(FLAT, /<TabHeader title=\{MY_FRENCH_TITLE\} purpose=\{MY_FRENCH_PURPOSE\} trailing=\{<ProfileButton \/>\} \/>/, 'the library must use the shared editorial header and profile entry');
    assert.match(SCREEN, /head: \{ position: 'relative' \}/, 'the art has nothing to position itself against');
    assert.equal((SCREEN.match(/<TabHeader\b/g) ?? []).length, 1, 'the tab opens with something other than one shared header');
    // The picture is the art module's to hide at the largest reading size and
    // to keep away from assistive technology; the tab must not re-decide either.
    assert.ok(!SCREEN.includes('PixelRatio'), 'the tab decides for itself when to hide the art');
    assert.ok(!SCREEN.includes('accessibilityRole="image"'), 'the tab announces the decoration');
  });

  test('every word this screen still spells is the module’s, and clean', () => {
    // The headings and the shelf's own sentence are all copy.ts's, so the app's
    // copy sweep can read them. What is left in the file is route names.
    for (const line of MY_FRENCH_COPY) {
      assert.ok(!SCREEN.includes(`'${line}'`), `My French spells "${line}" itself instead of reading it from copy.ts`);
    }
    for (const line of [...literals(SCREEN), ...literals(ROWS)]) {
      const banned = guiltIn(line);
      assert.equal(banned, undefined, `My French says ${line}, which carries the banned word "${banned}"`);
    }
    assert.ok(!SCREEN.includes('—'), 'My French carries an em dash into learner-facing copy');
    assert.match(FLAT, /import \{[^}]*MY_FRENCH_PURPOSE[^}]*\} from '\.\.\/myfrench\/copy\.ts'/, 'the tab reads its words from somewhere other than its copy module');
  });

  test('the page grows with the reading size instead of clipping', () => {
    // A layout that breaks at large text is broken. Nothing here caps a line
    // count, pins a reading size or types a width, so a title that needs two
    // lines gets two lines and the row gets taller.
    for (const capped of ['numberOfLines', 'maxFontSizeMultiplier', 'allowFontScaling', 'fontSize']) {
      for (const [name, body] of [['the tab', SCREEN], ['the rows', ROWS]] as const) {
        assert.ok(!body.includes(capped), `${name} writes ${capped}; the reading size is the learner's to choose`);
      }
    }
    assert.doesNotMatch(ROWS, /(width|height): \d/, 'the rows type a size instead of taking one from the tokens');
  });

  test('the tab reads each store once a visit and lets go cleanly when the learner leaves', () => {
    // A focus effect without its cancelled flag writes state into a screen the
    // learner has already left, which on a slow connection is a tab that flickers
    // back to an older self after they have moved on.
    assert.match(FLAT, /useFocusEffect\( useCallback\(\(\) => \{ let cancelled = false;/, 'the visit does not guard against answering after the learner has gone');
    assert.match(FLAT, /return \(\) => \{ cancelled = true; \};/, 'nothing cancels the reads when the tab goes away');
    for (const store of ['loadMissionCompletions()', 'loadDeck()', 'loadBookmarks()', 'loadSoundChecks()', 'loadConversationPacks()']) {
      assert.ok(SCREEN.includes(store), `the tab never reads ${store}, so a block of it can never appear`);
      assert.equal(SCREEN.split(store).length - 1, 1, `${store} is read more than once a visit`);
    }
  });

  test('nothing on this page invents a level, a score or a pronunciation measurement', () => {
    // A pronunciation score is never implied unless it came from audio measured
    // against a known reference, and this page measures nothing at all.
    for (const invented of ['levelFor(', 'score', 'accuracy', 'percent', 'mastery', 'grade']) {
      assert.ok(!SCREEN.toLowerCase().includes(invented.toLowerCase()), `My French reaches for ${invented}; this page measures nothing`);
    }
  });

  test('the page runs progress, conversations, collection, places, then every situation — whole-app phase 2', () => {
    // Top to bottom: one sentence of evidence, the conversations it came from,
    // the material the learner kept, where their French works and where to try
    // next, and one door into the whole catalogue.
    assert.ok(at('<TabHeader') < at('{progress !== null &&'), 'something sits above the header');
    assert.ok(at('{progress !== null &&') < at('<Label>{CONVERSATIONS_ROW}</Label>'), 'the progress sentence sits under the rows it summarises');
    assert.ok(at('<Label>{CONVERSATIONS_ROW}</Label>') < at('<Label>{COLLECTION_LABEL}</Label>'), 'the collection sits above the conversations');
    assert.ok(at('<Label>{COLLECTION_LABEL}</Label>') < at('<Label>{SAVED_LABEL}'), 'the saved scenes sit above the learner\'s own phrases');
    assert.ok(at('<Label>{SAVED_LABEL}') < at('<SituationsCard'), 'the places sit above what the learner saved');
    assert.ok(at('<SituationsCard') < at('label={BROWSE_LABEL}'), 'the catalogue door sits above the places');
    // The slogan is gone from routine visits: the purpose is one plain line.
    assert.ok(!SCREEN.includes('Real conversations'), 'the slogan is spelled on the screen');
  });

  test('the tab imports nothing it no longer draws', () => {
    // A dead import is a component one line from being drawn again by somebody
    // who reads the import list as an intention.
    for (const gone of ['OneLineCard', 'LedgerLane', 'AcousticCard', 'CadenceCard', 'NextSituationCard', 'PhrasebookScreen', 'ConversationPackLibrary', 'lanes.ts', 'primary.ts', 'Stat', 'PillButton', 'GhostButton', 'OutlineButton']) {
      assert.doesNotMatch(FLAT, new RegExp(`import \\{[^}]*\\b${gone}\\b[^}]*\\} from`), `the tab still imports ${gone}`);
      assert.ok(!FLAT.includes(`from '../myfrench/${gone}`), `the tab still imports ${gone}`);
    }
  });

  test('my french lays its list out the way the other tabs do, with no wrapper that can swallow it — F383', () => {
    // At accessibility XXXL this tab used to render its header and its subtitle
    // and nothing else, and it could not be scrolled past them. Every block sat
    // inside one `flexGrow: 1` view, which is what the scroll frame already is,
    // and the two fought over the height. Tutor uses no such wrapper, and this
    // one has none now: the blocks are the scroll's own children, each carrying
    // its own gap.
    assert.ok(!SCREEN.includes('flexGrow'), 'a growing wrapper is back around the page, which is what lost the whole tab at the largest text size');
    assert.match(FLAT, /<ScrollScreen bottom="tab">\s*(\{ \}\s*)?<View style=\{st\.head\}>/, 'the header is no longer the first child of the scroll frame');
    assert.ok(!SCREEN.includes('scroll: {'), 'the wrapper style survives, so the wrapper can be hung back on it');
    assert.doesNotMatch(SCREEN, /(height|maxHeight|flexBasis): /, 'the tab pins a height, which clips rather than grows when the reading size does');
  });

  test('every door on the page goes somewhere, so nobody is left in a dead end', () => {
    // One row without an onPress is a place a learner taps and nothing happens,
    // which on this page is the whole of what they came for.
    const rows = [...tags(FLAT, 'TintRow'), ...tags(FLAT, 'IconRowCard')];
    assert.ok(rows.length >= 2, `only ${rows.length} rows found on the page, so this proves little`);
    for (const row of rows) {
      assert.match(row, /onPress=\{/, `a row on My French goes nowhere: ${row.slice(0, 80)}`);
      assert.match(row, /accessibilityLabel=(?:\{|"[^"]+")/, `a row on My French names nothing to a screen reader: ${row.slice(0, 80)}`);
    }
    assert.match(ROWS_FLAT, /onPress=\{\(\) => onOpen\(row\.id, row\.action\.kind === 'refine'\)\}/, 'a situation row goes nowhere');
    // Whole-app phase 2 moved the shelf above the places; every row still
    // carries its own destination and its own full name.
    assert.ok(at('label={SHELF_LABEL}') < at('<SituationsCard'), 'the places open the page again, above the learner\'s own phrases');
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
 *
 * The list is read off the directory rather than typed out, because revamp A
 * moved where these cards are drawn without moving where they live, and a typed
 * list would have quietly stopped covering one of them.
 * =========================================================================== */

describe('My French speaks, and stops — F470', () => {
  const HERE = fileURLToPath(new URL('../myfrench/', import.meta.url));
  const SPEAKERS = readdirSync(HERE).filter((name) => name.endsWith('.tsx'));

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
    assert.ok(speaking.length >= 3, `only ${speaking.length} components speak, so the sweep covers nothing`);
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
    for (const name of [...SPEAKERS.map((n) => `../myfrench/${n}`), './MyFrenchTab.tsx']) {
      const body = stripComments(read(name));
      for (const listening of ['useAudioRecorder', 'SpeakCircle', 'scoreRecordedAttempt', 'consumeRecording']) {
        assert.ok(!body.includes(listening), `${name} reaches for ${listening}; nothing on this tab records`);
      }
    }
  });
});

/**
 * Stage 4 (2026-09-25): the learner's goals, each a row card that opens the
 * goal screen. Only when there is a goal; nothing at all otherwise. Row cards
 * rather than buttons, because this page draws no Outline, Ghost or Pill.
 */
describe('the goal rows on My French — Stage 4', () => {
  test('goal rows are drawn only when the learner has a goal, as row cards that open the goal screen', () => {
    assert.match(FLAT, /const goals = goalRows\(profile\.learnerGoals, MISSIONS\);/, 'the rows are not the pure goal-row model over the profile\'s goals');
    const drawn = SCREEN.indexOf('goals.map(');
    assert.notEqual(drawn, -1, 'the goal rows are not drawn');
    const gate = SCREEN.lastIndexOf('goals.length > 0 &&', drawn);
    assert.notEqual(gate, -1, 'a learner with no goal is shown an empty goal block');
    assert.ok(drawn - gate < 160, 'the gate is not on the block it holds back');
    // Stage 4 review (2026-09-25): the door carries an opaque key, never the
    // goal's words, because on the web a route's params are the address bar.
    assert.match(
      FLAT,
      /<IconRowCard key=\{row\.goal\} glyph=\{<DocumentGlyph color=\{accent\.primary\} \/>\} label=\{GOALS_ROW_LABEL\} line=\{row\.goal\} note=\{row\.line\} accessibilityLabel=\{row\.spoken\} onPress=\{\(\) => nav\.navigate\('GoalStep', \{ key: goalRouteKey\(row\.goal\) \}\)\} \/>/,
      'a goal row is not the row card with the goal, its next task and one door to the goal screen',
    );
    assert.ok(!/navigate\('GoalStep', \{ goal:/.test(FLAT), 'the goal\'s own words ride in the route again');
    assert.ok(!/seedTopic[^\n]*row\.goal|row\.goal[^\n]*seedTopic/.test(SCREEN), 'a goal becomes a seed topic, which is a Max-only door');
  });

  test('the goals are their own group, under the words the goal editor uses — Stage 4 browser proof', () => {
    // Without a heading of their own the goal cards read as part of "Your
    // collection" (lead browser proof, 2026-09-25). The heading is the one
    // the tutor-memory screen writes goals under, so it is one name, not two.
    const block = SCREEN.slice(SCREEN.indexOf('goals.length > 0 &&'), SCREEN.indexOf('goals.map('));
    assert.match(block, /<Label>\{GOALS_LABEL\}<\/Label>/, 'the goal cards have no heading of their own');
    assert.match(FLAT, /import \{ GOALS_LABEL \} from '\.\.\/profile\/tutorMemory\.ts';/, 'the heading is spelled again instead of shared with the goal editor');
  });

  test('the goal rows sit after the learner\'s own material and directly above the places to try', () => {
    assert.ok(at('fingerprint !== null &&') < at('goals.length > 0 &&'), 'the goals sit above the sound row');
    assert.ok(at('goals.length > 0 &&') < at('<SituationsCard'), 'the goals sit below the places to try');
    assert.ok(at('<Label>{SAVED_LABEL}') < at('goals.length > 0 &&'));
  });
});

describe('loading, unreadable and empty are three facts — whole-app phase 1', () => {
  test('My French shows Retry when its read fails, and never draws a failed read as an empty account', () => {
    assert.match(FLAT, /useState<'loading' \| 'ready' \| 'unread'>\('loading'\)/);
    assert.match(FLAT, /setStatus\(\(current\) => \(current === 'ready' \? 'ready' : 'unread'\)\)/, 'a failed read is silent or wipes a drawn page');
    assert.match(FLAT, /status === 'unread' && \(/);
    assert.match(FLAT, /label=\{MY_FRENCH_RETRY\} line=\{MY_FRENCH_UNREAD\}/);
    assert.match(FLAT, /\[user, adapter, attempt\]/, 'Retry does not re-run the read');
    assert.match(FLAT, /if \(!sameAccount\(\)\) return;/, 'the main read can draw the previous account');
  });

  test('a recent row keeps its French preview and its outcome as two separate lines', () => {
    assert.match(FLAT, /line=\{row\.preview\.join\(' · '\)\}/);
    assert.match(FLAT, /note=\{row\.line\}/);
    assert.doesNotMatch(FLAT, /\.join\('\. '\)/, 'the preview and the outcome are glued into one sentence again');
  });

  test('Conversations shows loading, then its archive or a Retry, never an empty archive for a failed read', () => {
    const screen = read('../conversationPacks/ConversationsScreen.tsx').replace(/\s+/g, ' ');
    assert.match(screen, /archive === null && !unread && \(/);
    assert.match(screen, /archive === null && unread && \(/);
    assert.match(screen, /if \(sameAccount\(\)\) setUnread\(true\);/);
    assert.match(screen, /\[user, adapter, attempt\]/);
  });
});
