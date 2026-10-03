import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('approved phrase audio caps remain hard ceilings with generation disabled', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20261003001510_approved_phrase_audio_caps.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
  const down = readFileSync(new URL('../../../supabase/rollback/20261003001510_down.sql', import.meta.url), 'utf8').replace(/--[^\n]*/g, '');
  for (const [kind, cap] of [['trial',20000],['paid',200000],['global',10000000]] as const) {
    assert.match(sql, new RegExp(`constraint phrase_audio_approved_${kind}_cap check \\(${kind}_cap_micro_usd <= ${cap}\\)`));
    assert.match(sql, new RegExp(`${kind}_cap_micro_usd=${cap}\\b`));
    assert.match(down, new RegExp(`drop constraint if exists phrase_audio_approved_${kind}_cap`));
  }
  assert.match(sql, /set enabled=false/);assert.match(down, /set enabled=false/);
  assert.doesNotMatch(sql + down, /(?:global|trial|paid)_spent_micro_usd\s*=|(?:global_window|paid_window)_start\s*=|delete from|truncate|insert into public\.phrase_audio_rates/i);
  // Actual transaction/reapply/spend preservation exercised by the disposable
  // SQL verifier, separate from this source contract; no host/vendor claim.
});
