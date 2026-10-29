// Stream D, LR-23 (F935, founder decision 21): a Max-only entry a Max learner sees says it is part of the plan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { MissionProgress } from '@luvani/core';

import { INCLUDED_IN_MAX, includedInMax } from './includedInMax.ts';
import { nextConversation } from '../tutor/nextConversation.ts';
import { recommended } from '../tutor/speakTabView.ts';

const read = (path: string): string => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

test('Max-only entries say they are included in Max', () => {
  assert.equal(INCLUDED_IN_MAX, 'Included in Max');
  assert.equal(includedInMax('continueArc', true), 'Included in Max');
  assert.equal(includedInMax('realMoment', true), 'Included in Max');
  assert.equal(includedInMax('continueArc', false), null, 'a locked entry keeps its lock, not this label');
  assert.equal(includedInMax('fixes', true), null, 'a Core feature is not labelled Max');
  // Tutor: "Continue your conversation".
  const thread = { kind: 'pack', packId: 'p1', seedTopic: { fr: 'Le café', en: 'The café' }, line: 'Pick it up' } as never;
  const next = nextConversation([] as MissionProgress[], thread, true);
  assert.equal(next.label, 'Continue your conversation');
  assert.equal(recommended(next).minutes, 'Included in Max');
  assert.equal(recommended(nextConversation([], null, true)).minutes === 'Included in Max', false);
  // Practice "Talk about it again", the library's continue, and Rehearse.
  assert.match(read('../practice/practiceTabView.ts'), /includedInMax\('continueArc', !revisitLocked\)/);
  assert.match(read('../conversationPacks/ConversationPackLibrary.tsx'), /includedInMax\('continueArc', true\)/);
  assert.match(read('../tutor/realMoments.ts'), /PLAN_INCLUDED = `\$\{includedInMax\('realMoment', true\)\}\.`/);
});
