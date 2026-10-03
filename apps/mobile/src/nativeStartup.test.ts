import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
test('a ready native app releases its launch screen after Outfit loads', () => {
  const app = read('../App.tsx');
  assert.match(app, /import \{ hide as hideNativeLaunch \} from 'expo-splash-screen';/);
  assert.match(app, /useEffect\(\(\) => \{\s*if \(loaded\) hideNativeLaunch\(\);\s*\}, \[loaded\]\);/);
  assert.match(app, /\{loaded \? \(/, 'the same ready state must release both font content and native launch surface');
  assert.doesNotMatch(app, /setTimeout\([^]*hideNativeLaunch/, 'no arbitrary delay may keep a ready screen hidden');
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
