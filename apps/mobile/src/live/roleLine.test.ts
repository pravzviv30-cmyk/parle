/**
 * F942: the learner is told who their tutor plays, before the narration
 * introduces that character, on the preview and in the live room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MISSIONS, type ConvoView } from '@luvani/core';
import { missionRoleLine, roleLine, sceneTurns, tutorLineTurns, ROLE_TURN_ID } from './roleLine.ts';
import { scenePreview } from '../scenes/scenePreview.ts';
import { pushTurn, type TurnLine } from './turns.ts';

const view = (narration: string | null): ConvoView => ({
  textTurnId: 'x1',
  sceneReply: { fr: 'Bonjour ! Qu’est-ce que je vous sers ?', frWritten: null, en: 'Hello! What can I get you?' },
  narration: narration === null ? null : { fr: narration, frWritten: null, en: narration },
} as unknown as ConvoView);

test('every mission names who the tutor plays before the narration does', () => {
  assert.equal(roleLine('Émilie', 'Karim, the barista'), 'Émilie plays Karim, the barista.');
  for (const mission of MISSIONS) {
    const line = missionRoleLine(mission.id, 'emilie');
    assert.ok(line !== null && line.startsWith('Émilie plays ') && line.includes(mission.tutorPart), `${mission.id}: ${line}`);
    assert.doesNotMatch(line!, /—|·/);
    // The preview carries the same part.
    assert.equal(scenePreview(mission.id, { audio: {} as never, voice: 'emilie' } as never)?.part, mission.tutorPart);
    // In the room, the role line is the first line, then the narration, then the tutor.
    let list: TurnLine[] = [];
    for (const turn of sceneTurns(view('Au comptoir.'), line)) list = pushTurn(list, turn.line, turn.id ?? 'n');
    assert.deepEqual(list.map(t => [t.who, t.en]), [['narration', line], ['narration', 'Au comptoir.'], ['tutor', 'Hello! What can I get you?']]);
    assert.equal(list[0]!.id, ROLE_TURN_ID);
  }
  // A free conversation casts nobody.
  assert.equal(missionRoleLine(undefined, 'emilie'), null);
  assert.equal(missionRoleLine('mission:nope', 'emilie'), null);
  // The hook adds the scene's turns through sceneTurns, once per session.
  const hook = readFileSync(new URL('./useLiveSession.ts', import.meta.url), 'utf8');
  assert.match(hook, /sceneTurns\(msg\.view, roleShownRef\.current \? null : missionRoleLine\(missionId, tutorVoice\)\)/);
  const screen = readFileSync(new URL('../scenes/ScenePreviewScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /roleLine\(tutorName, model\.part\)/);
});

test('a spoken coach line is a tutor line before the reply', () => {
  // F988: on an English reach or a way back the coach line is said aloud, in
  // place of the narration's English, so it is read where it is heard.
  const spoken = { ...view('Au comptoir.'), coachLine: 'You can say: un café, s’il vous plaît.', coachSpoken: true } as ConvoView;
  const turns = sceneTurns(spoken, null);
  assert.deepEqual(turns.map(t => [t.id, t.line.who, t.line.fr]), [
    ['narration:x1', 'narration', 'Au comptoir.'],
    ['coach:x1', 'tutor', 'You can say: un café, s’il vous plaît.'],
    ['tutor:x1', 'tutor', 'Bonjour ! Qu’est-ce que je vous sers ?'],
  ]);
  // A coach line that was only written stays off the thread, as before.
  const written = { ...view('Au comptoir.'), coachLine: 'Nice.' } as ConvoView;
  assert.deepEqual(sceneTurns(written, null).map(t => t.id), ['narration:x1', 'tutor:x1']);

  // The early tutor-line adds the same ids in the same order, before the view.
  const early = tutorLineTurns({
    t: 'tutor-line', textTurnId: 'x1',
    narration: { speaker: 'narrator', fr: 'Au comptoir.', frWritten: null, en: 'Au comptoir.' },
    coach: 'You can say: un café, s’il vous plaît.',
    reply: { speaker: 'Karim', fr: 'Bonjour ! Qu’est-ce que je vous sers ?' },
  }, null);
  assert.deepEqual(early.map(t => t.id), ['narration:x1', 'coach:x1', 'tutor:x1']);
  assert.equal(early[2]!.line.en, null, 'the English waits for the view');
  // ...and the view that follows adds no second copy, only the English.
  let list: TurnLine[] = [];
  for (const turn of early) list = pushTurn(list, turn.line, turn.id!);
  for (const turn of turns) list = pushTurn(list, turn.line, turn.id!);
  assert.deepEqual(list.map(t => [t.id, t.en]), [
    ['narration:x1', 'Au comptoir.'],
    ['coach:x1', null],
    ['tutor:x1', 'Hello! What can I get you?'],
  ]);
});
