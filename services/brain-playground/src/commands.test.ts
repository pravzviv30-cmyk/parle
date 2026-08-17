import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { parseCommand } from './commands.ts';

describe('parseCommand', () => {
  test('plain speech is not a command', () => {
    assert.equal(parseCommand('Bonjour, un café'), null);
    assert.equal(parseCommand('  je ne sais pas '), null);
  });

  test('a scenario carries its freeform request', () => {
    assert.deepEqual(parseCommand('/scenario meeting friends at a café in Paris'), {
      kind: 'scenario',
      request: 'meeting friends at a café in Paris',
    });
  });

  test('a bare /scenario is not a scene', () => {
    assert.equal(parseCommand('/scenario')!.kind, 'unknown');
  });

  test('strictness validates its level', () => {
    assert.deepEqual(parseCommand('/strictness strict'), { kind: 'strictness', level: 'strict' });
    assert.deepEqual(parseCommand('/strictness FLOW'), { kind: 'strictness', level: 'flow' });
    assert.equal(parseCommand('/strictness brutal')!.kind, 'unknown');
  });

  test('aide asks the tutor; help lists the commands — different things', () => {
    assert.equal(parseCommand('/aide')!.kind, 'aide');
    assert.equal(parseCommand('/help')!.kind, 'commands');
  });

  test('the rest of the verbs land', () => {
    for (const [line, kind] of [
      ['/silence', 'silence'],
      ['/skip', 'skip'],
      ['/recap', 'recap'],
      ['/profile', 'profile'],
      ['/reset-profile', 'reset-profile'],
      ['/quit', 'quit'],
      ['/exit', 'quit'],
    ] as const) {
      assert.equal(parseCommand(line)!.kind, kind, line);
    }
  });

  test('an unknown slash command reports itself', () => {
    assert.deepEqual(parseCommand('/dance'), { kind: 'unknown', input: '/dance' });
  });
});
