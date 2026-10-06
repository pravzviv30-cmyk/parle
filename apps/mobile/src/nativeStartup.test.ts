import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
/**
 * F691, superseded by F790 (2026-10-06). F691 found Expo 57 leaving the native
 * launch image above a ready app and released it once Outfit loaded. The
 * launch is now Hum turning on screen, and the screen that draws it is the
 * native launch frame exactly, so it releases the native one the moment it has
 * been laid out, which is earlier than Outfit, and still never on a timer.
 */
test('the native launch is released by the identical launch screen as soon as it is drawn, never by a timer', () => {
  const app = read('../App.tsx');
  const screen = strip(read('./launch/LaunchScreen.tsx'));
  assert.doesNotMatch(app, /expo-splash-screen/, 'App.tsx releases the native launch itself again, beside the launch screen');
  assert.match(screen, /import \{ hide as hideNativeLaunch, preventAutoHideAsync \} from 'expo-splash-screen';/);
  assert.match(screen, /onLayout=\{releaseNativeLaunch\}/, 'the launch screen does not release the native one when it is laid out');
  const start = screen.indexOf('const releaseNativeLaunch');
  const release = screen.slice(start, screen.indexOf('}, []);', start));
  assert.match(release, /hideNativeLaunch\(\);/, 'the release handler does not release anything');
  // Nothing may stand between being laid out and letting go: no timer, no
  // frame or interaction wait, no promise.
  assert.doesNotMatch(
    release,
    /setTimeout|setInterval|requestAnimationFrame|InteractionManager|\.then\(|await\b/,
    'the release waits for something before letting go',
  );
  assert.equal(screen.match(/hideNativeLaunch\(/g)?.length, 1, 'the native launch is released somewhere other than the layout handler');
  assert.equal(screen.match(/releaseNativeLaunch\b/g)?.length, 2, 'the release handler is called from somewhere other than layout');
  assert.match(app, /\{!launched && <LaunchScreen onDone=\{finishLaunch\} \/>\}/, 'nothing draws the launch screen over the app');
  assert.match(app, /\{loaded \? \(/, 'the first screen no longer waits for Outfit');
});

test('the native launch stays up until the launch screen is drawn over it', () => {
  // Expo drops the native launch on the app's first view unless told to wait,
  // and that view is the safe-area provider with nothing in it yet.
  const screen = strip(read('./launch/LaunchScreen.tsx'));
  const hold = screen.search(/^preventAutoHideAsync\(\)/m);
  assert.ok(hold >= 0, 'nothing holds the native launch, so the window can show empty before the launch screen arrives');
  assert.ok(hold < screen.indexOf('export function LaunchScreen'), 'the native launch is held from inside the component, after the first view');
  assert.match(
    read('../App.tsx'),
    /^import \{ LaunchScreen \} from '\.\/src\/launch\/LaunchScreen\.tsx';$/m,
    'App.tsx no longer loads the launch screen before it renders, so the hold comes too late',
  );
});

test('native purchases gets its paid plans from a platform-neutral contract', async () => {
  const native = read('./purchases/adapter.native.ts');
  assert.doesNotMatch(native, /from ['"]\.\/adapter(?:\.native)?\.ts['"]/);
  assert.match(native, /import \{ PAID_PLANS,[^\n]+from '\.\/contract\.ts';/);
  const contract = await import('./purchases/contract.ts');
  const web = await import('./purchases/adapter.ts');
  assert.deepEqual(contract.PAID_PLANS, ['starter', 'regular']);
  assert.equal(web.PAID_PLANS, contract.PAID_PLANS, 'the web public export must use the same ordered constant');
  assert.doesNotMatch(read('./purchases/contract.ts'), /from ['"](?:react-native|expo|\.\/adapter)/);
});
