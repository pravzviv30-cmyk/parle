import { test } from 'node:test';
import assert from 'node:assert/strict';
import { starterTasks, checkStarter, STARTER_GOALS } from './onboarding.ts';
test('every concrete goal has a distinct real starter, and length changes task count', () => {
  assert.equal(
    new Set(STARTER_GOALS.filter((g) => g !== 'because').map((g) => starterTasks(g)[0]!.id)).size,
    5,
  );
  for (const goal of STARTER_GOALS) {
    assert.equal(starterTasks(goal, 'tea', 5).length, 1);
    assert.equal(starterTasks(goal, 'tea', 10).length, 2);
    assert.equal(starterTasks(goal, 'tea', 15).length, 3);
  }
});
test('targets recognise their model and do not fabricate ability from unrelated or selected replies', () => {
  for (const goal of STARTER_GOALS)
    for (const task of starterTasks(goal, 'tea', 15)) {
      assert.equal(checkStarter(task, task.model, 'typed').accepted, true, task.id);
      assert.equal(checkStarter(task, 'xyz', 'spoken').accepted, false, task.id);
      assert.equal(checkStarter(task, task.model, 'model').evidence, 'model');
    }
  const tea = starterTasks('food', 'tea')[0]!;
  assert.equal(checkStarter(tea, 'Un café, merci.', 'typed').accepted, false);
});
test('target words inside a negation or unrelated sentence do not earn success', () => {
  const task = starterTasks('food', 'coffee', 5)[0]!;
  for (const reply of ['Je ne veux pas un café.', 'Je déteste le café.', 'Un café puis je ne veux rien dire.', 'xyz un café xyz', 'Je vais prendre un thé.']) assert.equal(checkStarter(task, reply, 'typed').accepted, false, reply);
  for (const reply of [task.model, 'Un café, merci.', 'Bonjour, un café, s’il vous plaît.']) assert.equal(checkStarter(task, reply, 'typed').accepted, true, reply);
});
