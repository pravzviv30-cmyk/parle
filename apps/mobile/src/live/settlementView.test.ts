import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('terminal typing recovery names a new conversation while healthy quiet mode continues', () => {
  const read = (name: string) => readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1');
  const error = read('./LiveErrorView.tsx');
  assert.match(error, /restartAsText\s*\?\s*<PillButton label=\{typedRestartLabel\}/);
  assert.match(error, /typedRestartLabel = 'Start a typed conversation'/);
  assert.match(read('../LiveSessionScreen.tsx'), /typedRestartLabel="Start a typed lesson"/);
  assert.match(error, /:\s*<PillButton label="Continue by typing"/);
  assert.equal((error.match(/disabled=\{retryBlocked\}/g) ?? []).length, 2);
  for (const name of ['../ConvoScreen.tsx','../LiveSessionScreen.tsx']) {
    const screen = read(name);
    assert.match(screen, /restartAsText=\{live\.settlement !== null\}/);
    assert.match(screen, /retryBlocked=\{live\.settlement\?\.kind === 'pending' \|\| live\.settlement\?\.kind === 'reconciliation'\}/);
    assert.match(screen, /settlementMessage=\{live\.settlement \? sessionSettlementCopy\(live\.settlement\) : null\}/);
  }
  assert.match(read('../RecapScreen.tsx'), /accessibilityLiveRegion="polite"[^\n]*>\{settlementMessage\}/);
});
