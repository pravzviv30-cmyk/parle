import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('Walk retains safety redirect and immediate exit while recap waits', () => {
  const screen = read('../ConvoScreen.tsx'); const room = read('./WalkRoom.tsx');
  assert.match(screen, /if \(walkMode\) return <WalkRoom[\s\S]*?safety=\{safety.kind === 'redirect' \? <SafetyBanner/);
  assert.match(room, /label="End now" onPress=\{onExit\}/);
  assert.match(screen, /useLayoutEffect\(\(\) => \{ recapBailLeave\.current = leaveNow; \}\);/);
  assert.match(screen, /if \(!finishing \|\| live.recap\) return;[\s\S]*?setTimeout\(\(\) => recapBailLeave\.current\(\), RECAP_WAIT_MS\)/);
  assert.doesNotMatch(room, /TextInput|switchToText|Type instead/);
});
test('Walk uses an explicit primer, default dark native capability and a monotonic interruption epoch', () => {
  assert.match(read('../nav/RootNavigator.tsx'), /if \(walkMode && !walkStarted\) return <WalkIntro/);
  assert.match(read('./observer.native.ts'), /EXPO_PUBLIC_LUVANI_WALK_MODE === '1'/);
  assert.match(read('./observer.native.ts'), /module\.epoch\(\) === epoch/);
  assert.match(read('../ConvoScreen.tsx'), /state === 'active'\) gate.check\(\)/);
  const swift = read('../../modules/luvani-audio-lifecycle/ios/LuvaniAudioLifecycleModule.swift');
  assert.match(swift, /if type == .began \{ self.interruptionEpoch \+= 1 \}/);
  assert.doesNotMatch(swift, /interruptionEpoch\s*=\s*0/);
});

test('Walk error recovery describes a new session and offers no in-room typed twin', () => {
  const screen = read('../ConvoScreen.tsx');
  assert.match(screen, /message=\{walkMode \? "Walk mode cannot continue\. Return to Tutor to try another scene or start a typed conversation\." : live.status.message\}/);
  assert.match(screen, /onType=\{!walkMode && typedDoorFor/);
});
