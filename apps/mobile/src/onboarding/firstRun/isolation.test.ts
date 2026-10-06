/**
 * The first run's new parts only draw (F754; come alive, README Part 5.C rules
 * line: no fetch, storage or tracking in the first-run screen tree).
 *
 * `PreAccountOnboarding.tsx` is the one place the first run sends a guest
 * attempt or saves a guest record, and only after the start sheet's age
 * question and Start; `legal/policy.test.ts` and `revamp/uxControls.test.ts`
 * already hold that screen. The parts in this folder take values by props, so
 * none of them may reach the network, a store, analytics or the activity
 * record on its own, by a call or by an import. Read as source, because there
 * is no renderer in this suite (docs/TESTING.md).
 */

import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const HERE = fileURLToPath(new URL('.', import.meta.url));

/** Comments go: a part that explains why it never calls fetch is not calling it. */
const code = (name: string) =>
  readFileSync(`${HERE}${name}`, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');

/** Modules a statement loads when the file runs; `import type` is erased and loads nothing. */
function runtimeImports(body: string): string[] {
  const out: string[] = [];
  for (const m of body.matchAll(/^[ \t]*(import|export)\s+(type\s+)?([^'";]*?)\s*from\s*'([^']+)'/gm)) {
    if (m[2]) continue;
    if (m[1] === 'export' && !/[{*]/.test(m[3] ?? '')) continue;
    out.push(m[4]!);
  }
  for (const m of body.matchAll(/^[ \t]*import\s+'([^']+)'/gm)) out.push(m[1]!);
  for (const m of body.matchAll(/\b(?:import|require)\(\s*'([^']+)'\s*\)/g)) out.push(m[1]!);
  return out;
}

/** What a part may not do itself: send, store, track, or record activity, a phrase or a reminder. */
const CALLS =
  /\bfetch\(|XMLHttpRequest|WebSocket|AsyncStorage|SecureStore|supabase|trackProductEvent|trackGuestMetric|trackAccountStarter|recordActivity|recordActiveDay|settleSitting|beginSettle|finishSettle|settleGuestHandoff|publishCelebrations|saveGuestPractice|startGuestPractice|sendGuestAttempt|clearGuestPractice|adoptGuestUsage|saveStarter|addPhrases|savePreAccountDraft|scheduleReminder|askReminderPermission|requestRecordingPermissions|requestPermissionsAsync|setItem\(/;

/** Modules that can send, store or record: none may be loaded by a part. */
const MODULES =
  /(^|\/)(storage|sync|analytics)\/|(^|\/)game\/(store|settle|events|gameLocal|guestHandoff|GameProvider)|(^|\/)profile\/store|(^|\/)reminders\/(schedule|store)|(^|\/)review\/store|(^|\/)progress\/activity|guestPractice|savedStarter|preAccountDraft|createFromDraft|@react-native-async-storage|expo-secure-store|expo-notifications|expo-file-system|@supabase|livekit/;

describe('the first-run parts only draw — F754', () => {
  test('no first-run page component can send, store or record activity', () => {
    const parts = readdirSync(HERE).filter((name) => /\.tsx?$/.test(name) && !name.includes('.test.'));
    // The parts the plan, the start sheet, the practice, the win, day one and
    // the save card are built from. A part moved elsewhere would leave this
    // folder and this check.
    for (const expected of ['PlanCard.tsx', 'PlanReveal.tsx', 'GoalTile.tsx', 'ConsentFacts.tsx', 'ExchangeSteps.tsx', 'MicMeter.tsx', 'WinCard.tsx', 'LiveFace.tsx', 'DayOne.tsx', 'WeekStrip.tsx', 'InvestmentList.tsx']) {
      assert.ok(parts.includes(expected), `onboarding/firstRun/${expected} is missing, so this check no longer reads it`);
    }
    for (const name of parts) {
      const body = code(name);
      const call = body.match(CALLS);
      assert.equal(call, null, `onboarding/firstRun/${name} calls ${call?.[0]} itself`);
      for (const spec of runtimeImports(body)) {
        assert.doesNotMatch(spec, MODULES, `onboarding/firstRun/${name} loads ${spec}, which can send, store or record`);
      }
    }
  });
});
