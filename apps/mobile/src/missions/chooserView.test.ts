/**
 * The first screen a new learner chooses from.
 *
 * Behaviour where there is a rule, and a source read where the claim is about
 * what a screen puts on glass: apps/mobile has no renderer, so "the chooser is
 * a stack screen a first run opens on" and "every card routes to a
 * conversation" can only be held here the way `nav/wiring.test.ts` holds the
 * end card, by reading the file and failing when the wiring retreats.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  CAFE_LESSON,
  FIRST_MISSION,
  MISSIONS,
  missionStates,
  newCard,
  replayRung,
  type MissionCompletion,
  type ReviewCard,
} from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { tutorDoors } from '../tutor/gate.ts';
import {
  LESS_HELP,
  MICROPHONE_NOTICE,
  PROMISE,
  TALK_FREELY,
  chooserView,
  hasSpokenBefore,
  headMissionId,
  missionReplay,
  missionStatus,
  replayNote,
  resumableMission,
} from './chooserView.ts';

const read = (relative: string) => readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');

function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

const NOW = Date.parse('2026-08-22T10:00:00Z');

/** A learner with nothing behind them: no completions, an empty deck. */
const firstEver = () => chooserView({ progress: missionStates([], [], NOW), spokenBefore: false });

function cardsFor(id: string, now: number): ReviewCard[] {
  const mission = MISSIONS.find((m) => m.id === id)!;
  return mission.phraseKeys.map((key) =>
    newCard({ id: key, kind: 'turn', front: key, back: key, context: '', ipa: '' }, now),
  );
}

describe('the first-win chooser — what a learner who has never spoken is shown', () => {
  test('a first-ever learner lands on the chooser with the café already chosen', () => {
    const view = firstEver();
    assert.equal(view.cards.length, MISSIONS.length, 'every mission is offered; none is locked');
    assert.equal(view.cards[0]?.id, FIRST_MISSION, 'the café is the shortest walk to a French sentence that worked');
    assert.equal(view.cards[0]?.primary, true, 'the chosen one carries the screen’s one solid action');
    assert.equal(
      view.cards.filter((c) => c.primary).length,
      1,
      'six equal choices is a decision handed to somebody with no way to make it',
    );
    // Chosen, not forced: the other five are still on the screen and still tappable.
    for (const card of view.cards.slice(1)) {
      assert.equal(card.primary, false);
      assert.ok(card.route.params.missionId.length > 0, 'a card nobody can open is a card that is not offered');
    }

    // And the screen is where a first run actually lands.
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(navigator, /<Stack\.Screen name="Missions"/, 'the chooser is not a stack screen yet');
    assert.match(navigator, /initialRouteName=/, 'nothing can open the app anywhere but the tabs');
    const app = stripComments(read('../../App.tsx'));
    assert.ok(app.includes('justOnboarded'), 'a brand new profile has no way to say it just finished');
    assert.ok(!app.includes("userKey('justOnboarded')"), 'the first-run flag is persisted, so a reinstall is the only way out of it');
  });

  test('a first-ever learner reaches the chooser on web as well as on native', () => {
    const app = stripComments(read('../../App.tsx'));
    assert.match(app, /useNavigationContainerRef<RootStackParamList>/, 'the web URL can still overrule the first-run route');
    assert.match(app, /onReady=\{openFirstMissionChooser\}/, 'nothing waits for web linking to finish resolving the initial URL');
    assert.match(app, /navigationRef\.resetRoot\([\s\S]*name:\s*'Missions'/, 'the ready navigator never replaces the URL-selected Home route');

    const links = stripComments(read('../nav/theme.ts'));
    assert.match(links, /Missions:\s*'missions'/, 'the first-run destination has no web URL');
  });

  test('every mission card routes to a conversation carrying its mission id', () => {
    const view = firstEver();
    for (const card of view.cards) {
      assert.deepEqual(
        card.route,
        { screen: 'Convo', params: { missionId: card.id } },
        `${card.id} does not open the conversation it names`,
      );
    }
    assert.equal(new Set(view.cards.map((c) => c.route.params.missionId)).size, MISSIONS.length, 'two cards share one id');

    // The route param has to exist for the id to survive the navigation.
    const types = stripComments(read('../nav/types.ts'));
    const convo = types.slice(types.indexOf('Convo:'), types.indexOf('Drill:'));
    assert.match(convo, /missionId\?:\s*string/, 'the conversation route cannot carry a mission id');
    assert.match(stripComments(read('./MissionsScreen.tsx')), /card\.route\.params/, 'the screen invents its own route');
  });

  test('the promise line shows only before the first conversation', () => {
    assert.equal(firstEver().promise, PROMISE, 'the promise is the whole reason this screen is worth a tap');
    assert.equal(
      chooserView({ progress: missionStates([], [], NOW), spokenBefore: true }).promise,
      null,
      'promising a first French line to somebody who has already said one is not paying attention',
    );

    // A conversation counts even when no mission was finished, because the
    // learner still had their first line.
    assert.equal(hasSpokenBefore([]), false);
    assert.equal(hasSpokenBefore([{ kind: 'drill' }, { kind: 'review' }]), false, 'a flashcard is not a conversation');
    assert.equal(hasSpokenBefore([{ kind: 'convo' }]), true);
    assert.equal(hasSpokenBefore([{ kind: 'lesson' }]), true, 'the guided lesson is speaking French too');

    assert.ok(!/—/.test(PROMISE), 'the promise carries an em dash');
    assert.match(stripComments(read('./MissionsScreen.tsx')), /view\.promise/, 'the screen never draws the promise');
  });

  test('the choosing screen explains the microphone before the first tap', () => {
    assert.equal(firstEver().microphoneNotice, MICROPHONE_NOTICE);
    assert.match(MICROPHONE_NOTICE, /microphone/i, 'the notice never names the permission it is preparing for');
    assert.match(MICROPHONE_NOTICE, /tap the circle/i, 'the notice does not say when the microphone opens');
    assert.match(MICROPHONE_NOTICE, /type/i, 'the notice leaves no quiet way through');
    assert.ok(!/—/.test(MICROPHONE_NOTICE), 'the notice carries an em dash');
    assert.equal(
      chooserView({ progress: missionStates([], [], NOW), spokenBefore: true }).microphoneNotice,
      null,
      'the chooser repeats first-run permission copy after the learner has spoken',
    );
    assert.match(
      stripComments(read('./MissionsScreen.tsx')),
      /view\.microphoneNotice/,
      'the decision exists but the chooser never puts it on glass',
    );
  });

  test('talk freely is still a door, and not the first one for a beginner', () => {
    const view = firstEver();
    assert.equal(view.talkFreely, TALK_FREELY, 'the free path is gone from the chooser');
    assert.notEqual(view.cards[0]?.id, undefined, 'a beginner opens on a mission, not on a blank page');

    // On the tutor tab it is a row among three ways in, and still a door
    // rather than a footnote: it is offered in the same list, with a heading of
    // its own. The two surfaces word it differently on purpose (F404). Here it
    // is one line among six situations, so it has to say what "else" means;
    // there it is "Open chat", the second of the three entry modes (F547), and
    // never the first: a beginner meets the everyday mission first, and the
    // fixed script last of all.
    const doors = tutorDoors(null, MISSIONS.length, CAFE_LESSON.title).map((d) => d.label);
    assert.ok(doors.includes('Open chat'), 'the tutor tab dropped the free conversation entirely');
    assert.equal(doors[0], 'Everyday mission', 'a beginner meets a situation first');
    assert.notEqual(doors[0], 'Open chat', '"say anything" is what a beginner says nothing to');
    assert.equal(doors[doors.length - 1], 'Pronunciation lesson', 'a beginner meets the fixed script before the situations');
    assert.equal(
      tutorDoors(
        { title: 'Au café du coin', goalEn: 'Order at a café', place: 'cafe', minutesRemaining: null },
        MISSIONS.length,
        CAFE_LESSON.title,
      ).at(-1)?.key,
      'lesson',
      'and the lesson stays last',
    );

    const tab = stripComments(read('../tabs/TutorTab.tsx'));
    assert.match(tab, /doors\.map\(/, 'the tab draws its own order instead of the one that was decided');
    assert.ok(tab.includes('open(true)'), 'the quiet typed door left the tab with the intro');
  });
});

describe('the chooser — what each card says about where the learner is', () => {
  test('a mission whose phrases fall due says so before it says anything else', () => {
    const done: MissionCompletion[] = [{ id: 'mission:cafe', at: NOW - 86_400_000, rung: 4 }];
    const deck = cardsFor('mission:cafe', NOW - 86_400_000);
    const view = chooserView({ progress: missionStates(done, deck, NOW), spokenBefore: true });
    const cafe = view.cards.find((c) => c.id === 'mission:cafe')!;
    assert.equal(cafe.state, 'needs-review');
    assert.equal(cafe.status, 'Ready to come back to');
    assert.equal(view.cards[0]?.id, 'mission:cafe', 'what the scheduler wants back is what is offered first');
  });

  test('nothing a card says is a score, a count or a percentage', () => {
    const view = chooserView({ progress: missionStates([], [], NOW), spokenBefore: true });
    const lines = [
      ...view.cards.map((c) => c.status),
      missionStatus('complete', 'with-help'),
      missionStatus('complete', 'on-your-own'),
      missionStatus('in-progress', 'new'),
    ];
    for (const line of lines) {
      assert.ok(!/\d/.test(line), `"${line}" carries a number`);
      assert.ok(!/%/.test(line), `"${line}" carries a percentage`);
      assert.ok(!/—/.test(line), `"${line}" carries an em dash`);
      assert.ok(!/\b(score|correct|wrong|failed|only)\b/i.test(line), `"${line}" reads as a mark`);
    }
  });

  test('help still shows in the words, without turning into a grade', () => {
    assert.equal(missionStatus('complete', 'with-help'), 'You did this one with help');
    assert.equal(missionStatus('complete', 'on-your-own'), 'You did this one on your own');
    assert.equal(missionStatus('new', 'new'), 'Ready when you are');
  });

  test('the tutor tab is offered the mission worth continuing, and never one nobody started', () => {
    assert.equal(resumableMission(missionStates([], [], NOW)), null, 'nothing started is nothing to continue');
    const done: MissionCompletion[] = [{ id: 'mission:amis', at: NOW, rung: 2 }];
    const resumable = resumableMission(missionStates(done, [], NOW));
    assert.equal(resumable?.mission.id, 'mission:amis');
  });
});

describe('a door that names a mission opens onto that mission', () => {
  test('the chooser leads with the mission the previous screen promised', () => {
    // The Tutor tab's Continue door glosses itself with a mission title and then
    // opens this screen. Without a focus the screen led with whatever
    // suggestedMission preferred, so for anyone with a phrase falling due
    // elsewhere the door named one mission and the screen offered another. Two
    // orderings, one learner, and the thing they tapped was not the thing they
    // got.
    const progress = missionStates(
      [{ id: 'mission:hotel', at: 1_000, rung: 3 }],
      [],
      NOW,
    );

    const promised = chooserView({ progress, spokenBefore: true, focus: 'mission:hotel' });
    assert.equal(promised.cards[0]?.id, 'mission:hotel', 'the promise made on the door is what opens');

    const unpromised = chooserView({ progress, spokenBefore: true });
    assert.equal(
      headMissionId({ progress, spokenBefore: true }),
      unpromised.cards[0]?.id,
      'and with nothing promised the screen still makes its own choice',
    );
  });

  test('a focus nobody has heard of is ignored rather than obeyed', () => {
    // Route params are not trusted input, but they are not sanitised either:
    // an id that is not in the catalogue simply does not win, and the screen
    // falls back to what it would have chosen on its own.
    const progress = missionStates([], [], NOW);
    const view = chooserView({ progress, spokenBefore: true, focus: 'mission:nope' });

    assert.equal(view.cards[0]?.id, headMissionId({ progress, spokenBefore: true }));
    assert.equal(view.cards.length, progress.length, 'and nothing is dropped from the list');
  });
});

describe('walking back into a scene you have already finished', () => {
  const DAY = 86_400_000;
  /** The props block passed to the conversation screen inside the route. */
  function convoScreenProps(navigator: string): string {
    const open = navigator.indexOf('<LazyConvoScreen');
    assert.ok(open >= 0, 'the conversation route still renders the conversation screen');
    return navigator.slice(open, navigator.indexOf('/>', open));
  }

  test('a finished mission replays with less help and says so once', () => {
    // Exactly the records missions/store.ts keeps: plain id, epoch, plain rung,
    // a short history per mission rather than one row overwritten.
    const stored = [
      { id: 'mission:cafe', at: NOW - 3 * DAY, rung: 1 },
      { id: 'mission:cafe', at: NOW - DAY, rung: 2 },
      { id: 'mission:hotel', at: NOW, rung: 4 },
    ];

    const replay = missionReplay('mission:cafe', stored);
    assert.deepEqual(
      replay,
      { lastRung: 2, startRung: 3 },
      'the replay is pitched off the most recent finish of THIS mission, one rung up',
    );
    assert.equal(replay?.startRung, replayRung(2), 'the raise and its ceiling are core’s, not a second copy kept here');

    // The claim is read off what the session actually opened on, which is the
    // rung the opening view publishes. Said once: the learner’s first turn
    // retires it, so a note about how this replay began does not follow them
    // through a scene it has stopped describing.
    assert.equal(replayNote({ replay, openedRung: 3, spokenThisSession: false }), LESS_HELP);
    assert.equal(
      replayNote({ replay, openedRung: 3, spokenThisSession: true }),
      null,
      'the opening note is still on screen after the learner has answered',
    );

    // The delivery, which is where every hop of this pipe has broken before: a
    // rule that decides correctly and is wired to nothing passes its own suite.
    const navigator = stripComments(read('../nav/RootNavigator.tsx'));
    assert.match(navigator, /loadMissionCompletions\(\)/, 'the route never reads what this learner has finished');
    assert.match(
      navigator,
      /missionReplay\(missionId, stored\)/,
      'the route works the replay out by hand instead of asking the rule',
    );
    assert.match(
      convoScreenProps(navigator),
      /replay=\{replayRead\.replay\}/,
      'the replay is computed in the navigator and dies there',
    );

    const screen = stripComments(read('../ConvoScreen.tsx'));
    const call = screen.slice(screen.indexOf('useLiveSession('), screen.indexOf('useLiveSession(') + 400);
    assert.match(
      call,
      /useLiveSession\(userId, 'convo-01', replay\?\.startRung,/,
      'the requested rung has to reach the join token, or the replay opens exactly where every session opens',
    );
    assert.match(screen, /replayNote\(\{/, 'the screen decides for itself when the note is true');
    assert.ok(!screen.includes(LESS_HELP), 'the line is spelled out in the screen, where the rule cannot hold it');
    assert.match(
      screen,
      /replayLine \? \([\s\S]{0,300}\{replayLine\}/,
      'the note is worked out and never reaches glass',
    );
  });

  test('the replay note appears only when the rung rises', () => {
    // Rung 4 is already no support at all, so a replay of it withdraws nothing.
    // Saying less help this time to somebody who had none last time is a plain
    // untruth, and it is the only reason this rule is a function.
    const atTheTop = missionReplay('mission:cafe', [{ id: 'mission:cafe', at: NOW, rung: 4 }]);
    assert.deepEqual(atTheTop, { lastRung: 4, startRung: 4 }, 'the top rung replays as itself');
    assert.equal(
      replayNote({ replay: atTheTop, openedRung: 4, spokenThisSession: false }),
      null,
      'a learner already at the top is told help was withdrawn that was never there',
    );

    // Nothing finished is nothing to replay, and an ordinary conversation is
    // not a replay of anything.
    assert.equal(missionReplay('mission:cafe', []), null);
    assert.equal(missionReplay(undefined, [{ id: 'mission:cafe', at: NOW, rung: 2 }]), null);
    assert.equal(replayNote({ replay: null, openedRung: 3, spokenThisSession: false }), null);

    const replay = missionReplay('mission:cafe', [{ id: 'mission:cafe', at: NOW, rung: 2 }]);
    // The engine may refuse the rung we asked for and open where it always
    // opens. The note is read off the opening publish rather than off the value
    // we sent, so the app never talks about a session it did not get.
    assert.equal(
      replayNote({ replay, openedRung: 1, spokenThisSession: false }),
      null,
      'a scene that opened below the last finish still claims less help',
    );
    assert.equal(
      replayNote({ replay, openedRung: 2, spokenThisSession: false }),
      null,
      'a scene that opened exactly where the last one finished still claims less help',
    );
    assert.equal(
      replayNote({ replay, openedRung: null, spokenThisSession: false }),
      null,
      'the note is claimed before there is an opening view to read it off',
    );
    assert.equal(replayNote({ replay, openedRung: 3, spokenThisSession: false }), LESS_HELP);

    // A record written by a build that knew a mission or a ladder this one does
    // not is dropped rather than raised from.
    assert.equal(missionReplay('mission:nope', [{ id: 'mission:nope', at: NOW, rung: 2 }]), null);
    assert.equal(missionReplay('mission:cafe', [{ id: 'mission:cafe', at: NOW, rung: 9 }]), null);

    // And the sentence itself, held against the one shared list.
    assert.equal(guiltIn(LESS_HELP), undefined, `"${LESS_HELP}" says a word the app promised never to say`);
    assert.ok(!/\d/.test(LESS_HELP), 'the note carries a number');
    assert.ok(!/[—%]/.test(LESS_HELP), 'the note carries an em dash or a percentage');
  });
});
