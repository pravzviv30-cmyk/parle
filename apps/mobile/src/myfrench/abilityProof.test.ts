import assert from 'node:assert/strict';
import { test } from 'node:test';
import { missionStates, type MissionCompletion } from '@luvani/core';
import { abilityProof } from './abilityProof.ts';

const NOW = Date.UTC(2026, 9, 3);

test('only an independent finish with a valid scene and date becomes a dated ability', () => {
  const helped: MissionCompletion[] = [{ id: 'mission:cafe', at: NOW - 2, rung: 2 }];
  assert.equal(abilityProof(missionStates(helped, [], NOW), helped), null);
  const independent: MissionCompletion[] = [...helped, { id: 'mission:cafe', at: NOW - 1, rung: 4 }];
  const proof = abilityProof(missionStates(independent, [], NOW), independent, NOW);
  assert.equal(proof?.mission.id, 'mission:cafe');
  assert.equal(proof?.at, NOW - 1);
  assert.equal(abilityProof(missionStates(independent, [], NOW), [{ id: 'missing', at: NOW, rung: 4 }]), null);
  assert.equal(abilityProof(missionStates(independent, [], NOW), [{ id: 'mission:cafe', at: NOW + 1, rung: 4 }], NOW), null);
});

test('a later supported replay never removes the original independent proof', () => {
  const completions: MissionCompletion[] = [
    { id: 'mission:cafe', at: NOW - 2, rung: 4 },
    { id: 'mission:cafe', at: NOW - 1, rung: 1 },
  ];
  assert.equal(abilityProof(missionStates(completions, [], NOW), completions)?.at, NOW - 2);
});
