import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { PLANS } from '@parle/core';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const initialMigration = readFileSync(path.join(ROOT, 'supabase', 'migrations', '202608220001_parle_learning.sql'), 'utf8');
const hardeningMigration = readFileSync(
  path.join(ROOT, 'supabase', 'migrations', '202608230001_session_usage_idempotency.sql'),
  'utf8',
);
const migration = `${initialMigration}\n${hardeningMigration}`;

describe('database security contract — SQL cannot drift quietly', () => {
  test('the atomic debit uses the same plan limits as core', () => {
    for (const plan of Object.values(PLANS)) {
      assert.match(
        migration,
        new RegExp(`when '${plan.id}' then ${plan.secondsPerPeriod}\\b`),
        `${plan.id} has a different allowance in SQL and TypeScript`,
      );
    }
  });

  test('the debit is a fixed-search-path security definer unavailable to clients', () => {
    assert.match(hardeningMigration, /security definer\s+set search_path = ''/i);
    assert.match(
      hardeningMigration,
      /revoke all on function public\.consume_entitlement\(uuid, integer, uuid\) from public, anon, authenticated;/i,
    );
    assert.match(hardeningMigration, /grant execute on function public\.consume_entitlement\(uuid, integer, uuid\) to service_role;/i);
    assert.match(hardeningMigration, /p_seconds is null or p_seconds < 0 or p_seconds > 900/i);
  });

  test('session usage is private and makes a repeated session id a no-op', () => {
    assert.match(hardeningMigration, /create table if not exists public\.session_usage/i);
    assert.match(hardeningMigration, /session_id uuid primary key/i);
    assert.match(hardeningMigration, /alter table public\.session_usage enable row level security/i);
    assert.match(hardeningMigration, /revoke all on table public\.session_usage from public, anon, authenticated/i);
    assert.match(hardeningMigration, /on conflict \(session_id\) do nothing/i);
    assert.match(hardeningMigration, /if not recorded then/i);
  });

  test('a trial can be claimed only once per pseudonymous installation and user signal', () => {
    assert.match(hardeningMigration, /create table if not exists public\.trial_installations/i);
    assert.match(hardeningMigration, /installation_hash text primary key/i);
    assert.match(hardeningMigration, /first_user_hash text not null unique/i);
    assert.match(hardeningMigration, /alter table public\.trial_installations enable row level security/i);
    assert.match(hardeningMigration, /create or replace function public\.claim_trial/i);
    assert.match(hardeningMigration, /on conflict do nothing\s+returning true into claimed/i);
    assert.match(hardeningMigration, /grant execute on function public\.claim_trial\(uuid, text, text\) to service_role/i);
    assert.doesNotMatch(hardeningMigration, /trial_installations[\s\S]{0,300}references auth\.users/i);
  });

  test('learner state has own-row read, insert, update and delete policies', () => {
    for (const operation of ['select', 'insert', 'update', 'delete']) {
      assert.match(migration, new RegExp(`on public\\.learner_state for ${operation}`, 'i'));
    }
    assert.match(migration, /for update\s+using \(auth\.uid\(\) = user_id\)\s+with check \(auth\.uid\(\) = user_id\)/i);
  });

  test('clients can append events but cannot select event history or mutate entitlements', () => {
    assert.match(migration, /on public\.product_events for insert\s+with check \(auth\.uid\(\) = user_id\)/i);
    assert.doesNotMatch(migration, /on public\.product_events for select/i);
    assert.match(migration, /on public\.entitlements for select\s+using \(auth\.uid\(\) = user_id\)/i);
    assert.doesNotMatch(migration, /on public\.entitlements for (insert|update|delete)/i);
  });

  test('direct database event inserts cross the same exact-schema privacy boundary', () => {
    assert.match(hardeningMigration, /create or replace function public\.validate_product_event\(\)/i);
    assert.match(hardeningMigration, /jsonb_object_length\(new\.properties\)/i);
    for (const name of [
      'onboarding_completed',
      'mission_started',
      'mission_completed',
      'sound_check_completed',
      'my_french_opened',
    ]) {
      assert.match(hardeningMigration, new RegExp(`new\\.name = '${name}'`, 'i'));
    }
    assert.match(hardeningMigration, /else\s+raise exception 'unsupported product event'/i);
    assert.match(hardeningMigration, /before insert or update on public\.product_events/i);
  });
});
