/**
 * F942: the learner is told who their tutor plays, before the narration
 * introduces that character, on the preview and in the live room.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { MISSIONS, type ConvoView } from '@luvani/core';
import { missionRoleLine, roleLine, sceneTurns, ROLE_TURN_ID } from './roleLine.ts';
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
