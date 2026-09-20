import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { describe, test } from 'node:test';

import { guiltIn } from '../copy/guilt.ts';
import { CAPABILITY_COPY, capabilitiesFor, planInclusions } from './capabilities.ts';

const SRC = fileURLToPath(new URL('..', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...sourceFiles(full));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

describe('what a plan opens, said in one place (F564, F565)', () => {
  test('each plan lists only what capabilities.ts opens, and nothing gates packs, phrases or missions', () => {
    for (const plan of ['trial', 'starter', 'regular'] as const) {
      const opened = capabilitiesFor(plan);
      // Earned learning is never gated, on any plan, lapsed or not.
      assert.equal(opened.packs, true);
      assert.equal(opened.savedPhrases, true);
      assert.equal(opened.missions, true);
      assert.equal(opened.memory, true);
      assert.deepEqual(capabilitiesFor(plan, true).packs, true);
    }
    assert.equal(capabilitiesFor('regular').customRehearsal, true);
    assert.equal(capabilitiesFor('regular').continueArc, true);
    assert.equal(capabilitiesFor('starter').customRehearsal, false);
    assert.equal(capabilitiesFor('regular', true).customRehearsal, false, 'a lapsed Max keeps a Max door');

    // The inclusions say only what the table opens, and the two Max lines
    // appear on Max alone.
    const starter = planInclusions('starter');
    const max = planInclusions('regular');
    assert.ok(max.length > starter.length, 'Max lists nothing Starter does not');
    for (const line of starter) assert.ok(max.includes(line), `Starter lists "${line}" and Max does not`);
    for (const line of max) {
      assert.equal(guiltIn(line), undefined, `"${line}" carries "${guiltIn(line)}"`);
      assert.doesNotMatch(line, /\d|—|%/, `"${line}" carries a digit, an em dash or a percentage`);
    }
    assert.deepEqual(planInclusions('trial'), starter, 'the trial and Starter open different learning, and they do not');

    // Nothing that draws earned learning asks this table: the tabs, the
    // drills, the review and the packs open for everyone. Only the two Max
    // doors may read it.
    const askers = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes('capabilitiesFor('))
      .map((file) => file.slice(SRC.length))
      .sort();
    assert.deepEqual(askers, ['purchases/capabilities.ts', 'tabs/TutorTab.tsx', 'tutor/RealMomentScreen.tsx'], `something else gates on the plan: ${askers.join(', ')}`);
    assert.ok(askers.includes('tutor/RealMomentScreen.tsx'), 'the real moment no longer asks the plan');
    for (const line of CAPABILITY_COPY) assert.equal(guiltIn(line), undefined);
  });

  test('a learner on the trial meets an honest line and a door to plans, and an unknown plan reads as the trial', () => {
    assert.deepEqual(capabilitiesFor('unknown'), capabilitiesFor('trial'), 'a plan nobody could read opens a door the trial does not');
    assert.equal(capabilitiesFor('trial').customRehearsal, false);
    const screen = readFileSync(join(SRC, 'tutor', 'RealMomentScreen.tsx'), 'utf8');
    assert.match(screen, /status === null \? null : capabilitiesFor\(status\.plan, status\.lapsed\)\.customRehearsal/, 'an unread plan cannot be treated as an upgrade opportunity');
    assert.match(screen, /\{allowed === false && \([\s\S]*?\{MAX_ONLY_LINE\}[\s\S]*?<OutlineButton label=\{SEE_PLANS\} onPress=\{onSeePlans\}/, 'a gated learner is not told plainly, or has no way to the plans');
    assert.match(screen, /\{allowed === true && \([\s\S]*?<PillButton label=\{checking \? 'Connecting…' : REHEARSE_ACTION\}/, 'an allowed learner has no way to rehearse');
    assert.match(screen, /allowed === null && <Text accessibilityLiveRegion="polite"/, 'plan loading or failure is explained');
  });
});
