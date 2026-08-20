/**
 * The fleet's structural contract.
 *
 * scripts/gate.mjs already refuses an agent that is on disk without a model pin. These
 * tests cover the rules a regex in the gate cannot reasonably carry: the field order, the
 * name matching the file it is dispatched by, and the guards staying unable to edit. They
 * read the real files, because a test of a fixture would defend a fixture.
 */

import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import {
  agentProblems,
  parseAgentFrontmatter,
  pinnedAgents,
  routedAgents,
  READ_ONLY_AGENTS,
} from '../../shared/agentFleet.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const AGENT_DIR = path.join(ROOT, '.claude', 'agents');

const read = (...parts: string[]) => readFileSync(path.join(ROOT, ...parts), 'utf8');
const slugs = () =>
  readdirSync(AGENT_DIR)
    .filter((f) => f.endsWith('.md'))
    .map((f) => f.slice(0, -3))
    .sort();

describe('the agent fleet — every definition on disk', () => {
  test('carries name, description, tools and model, in that order', () => {
    const broken: string[] = [];
    for (const slug of slugs()) broken.push(...agentProblems(slug, read('.claude', 'agents', `${slug}.md`)));
    assert.deepEqual(broken, [], 'a malformed agent dispatches anyway and fails silently');
  });

  test('is pinned to a model in the gate, so none inherits the session model unnoticed', () => {
    const pinned = pinnedAgents(read('scripts', 'gate.mjs'));
    assert.ok(pinned.length > 0, 'the gate AGENT_MODELS block could not be read at all');
    const unpinned = slugs().filter((s) => !pinned.includes(s));
    assert.deepEqual(unpinned, [], 'an unpinned agent runs on whatever model the session happened to use');
  });

  test('is a real file when the gate names it', () => {
    const present = new Set(slugs());
    const missing = pinnedAgents(read('scripts', 'gate.mjs')).filter((a) => !present.has(a));
    assert.deepEqual(missing, [], 'the gate pins an agent that does not exist');
  });
});

describe('the agent fleet — who may change the repository', () => {
  test('a guard declares no Edit and no Write, because it decides rather than does', () => {
    for (const slug of READ_ONLY_AGENTS) {
      const head = parseAgentFrontmatter(read('.claude', 'agents', `${slug}.md`));
      assert.ok(head, `${slug} has no frontmatter`);
      assert.ok(!head.tools.includes('Edit'), `${slug} could edit the work it is judging`);
      assert.ok(!head.tools.includes('Write'), `${slug} could write the work it is judging`);
    }
  });

  test('a guard says in its own words that the missing tools are deliberate', () => {
    for (const slug of READ_ONLY_AGENTS) {
      const body = read('.claude', 'agents', `${slug}.md`);
      assert.match(
        body,
        /no `Edit`|no Edit and no Write|You have no `Edit`/,
        `${slug} never explains why it cannot edit, so the next person will "fix" it`,
      );
    }
  });
});

describe('the agent fleet — the routing that dispatches it', () => {
  test('names only engineers that exist', () => {
    const present = new Set(slugs());
    const ghosts = routedAgents(read('.claude', 'commands', 'forge.md')).filter((a) => !present.has(a));
    assert.deepEqual(ghosts, [], '/forge routes work to an agent that is not there');
  });

  test('gives every builder somewhere to be dispatched from', () => {
    const routed = new Set(routedAgents(read('.claude', 'commands', 'forge.md')));
    const ship = read('.claude', 'commands', 'ship.md');
    const orphans = slugs().filter((slug) => {
      if (!slug.endsWith('-engineer')) return false;
      return !routed.has(slug) && !ship.includes(slug);
    });
    assert.deepEqual(orphans, [], 'an engineer nobody routes to is an agent that never runs');
  });
});
