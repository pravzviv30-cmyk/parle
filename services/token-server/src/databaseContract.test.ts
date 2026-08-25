import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, test } from 'node:test';

import { PLANS } from '@parle/core';

import { SUPABASE_PROOFS } from './verify/supabaseLive.ts';

const ROOT = path.resolve(import.meta.dirname, '..', '..', '..');
const MIGRATIONS = path.join(ROOT, 'supabase', 'migrations');
const ROLLBACKS = path.join(ROOT, 'supabase', 'rollback');

/** Every migration, in the order the runbook pastes them. */
const migrationFiles = readdirSync(MIGRATIONS)
  .filter((name) => name.endsWith('.sql'))
  .sort();
const sqlOf = (name: string): string => readFileSync(path.join(MIGRATIONS, name), 'utf8');

const initialMigration = sqlOf('202608220001_parle_learning.sql');
const hardeningMigration = sqlOf('202608230001_session_usage_idempotency.sql');
const trialFixMigration = sqlOf('202608240001_claim_trial_null_fix.sql');
const debitFixMigration = sqlOf('202608250001_consume_entitlement_null_fix.sql');
const eventFixMigration = sqlOf('202608250002_product_event_key_count_fix.sql');
const migration = migrationFiles.map(sqlOf).join('\n');

/**
 * SQL with its `--` comments removed.
 *
 * Every assertion about what a migration *does* reads this, because a migration that
 * quotes the defect it is fixing — which the ones here deliberately do, so the record
 * survives — would otherwise fail a `doesNotMatch` written about its code.
 */
const stripComments = (sql: string): string => sql.replace(/--[^\n]*/g, '');

/** The header regexes that identify each function whose body the contract reads. */
const FUNCTION_HEADERS = {
  claim_trial: /create or replace function public\.claim_trial\b/i,
  consume_entitlement_session:
    /create or replace function public\.consume_entitlement\(\s*p_user_id uuid,\s*p_seconds integer,\s*p_session_id uuid\s*\)/i,
  validate_product_event: /create or replace function public\.validate_product_event\(\)/i,
} as const;

/**
 * The body of the last definition of one function in migration order — the definition a
 * database actually ends up with once the runbook has been followed. Reading the newest
 * file directly would miss a later migration undoing it, and reading the oldest would
 * miss the fix.
 */
function effectiveBody(header: RegExp): string {
  const pattern = new RegExp(`${header.source}[\\s\\S]*?as \\$\\$([\\s\\S]*?)\\$\\$;`, 'gi');
  let body: string | null = null;
  for (const name of migrationFiles) {
    const last = [...sqlOf(name).matchAll(pattern)].at(-1);
    if (last?.[1]) body = last[1];
  }
  assert.ok(body, `no migration defines the function matched by ${header}`);
  return body;
}

// ---------------------------------------------------------------- claim_trial

const effectiveClaimTrialBody = (): string => effectiveBody(FUNCTION_HEADERS.claim_trial);

/** The `if <condition> then return false; end if;` refusal, as written. */
function refusalGuard(body: string): string {
  const guard = body.match(/^\s*if\s+(.+?)\s+then\s+return false;\s*end if;\s*$/im);
  assert.ok(guard?.[1], 'claim_trial has no single-line refusal guard to read');
  return guard[1].trim();
}

/**
 * The condition consume_entitlement puts on the branch that follows a conflicting
 * `insert ... returning true into recorded` — the branch holding the ownership check and
 * the idempotent early return. Comments are stripped first, because the migration that
 * fixes this quotes the defect it fixes.
 */
function idempotencyGuard(body: string): string {
  const guard = stripComments(body).match(/returning true into recorded;\s*if\s+([\s\S]+?)\s+then\b/i);
  assert.ok(guard?.[1], 'consume_entitlement has no idempotency guard after the ledger insert');
  return guard[1].replace(/\s+/g, ' ').trim();
}

type Tri = boolean | null;

const not3 = (value: Tri): Tri => (value === null ? null : !value);
const and3 = (a: Tri, b: Tri): Tri => (a === false || b === false ? false : a === null || b === null ? null : true);
const or3 = (a: Tri, b: Tri): Tri => (a === true || b === true ? true : a === null || b === null ? null : false);

/**
 * Evaluate a claim_trial guard the way Postgres would, in three-valued logic.
 *
 * This is the whole point of F73 and the reason a text assertion was not enough. The
 * insert is `on conflict do nothing ... returning true into claimed`, and RETURNING INTO
 * assigns NULL when the statement affects zero rows — so `claimed` is genuinely NULL on
 * the refusal path, whatever it was initialised to. `not NULL` is NULL, an IF on NULL
 * takes neither branch, and control falls through to provision a trial.
 *
 * Unknown syntax throws rather than passing: a guard this cannot read is a guard nobody
 * has proved anything about.
 */
function evaluateSqlGuard(expression: string, values: Record<string, Tri>): Tri {
  const tokens = expression
    .toLowerCase()
    .replace(/([(),])/g, ' $1 ')
    .split(/\s+/)
    .filter(Boolean);
  let at = 0;
  const peek = (): string | undefined => tokens[at];
  const take = (expected?: string): string => {
    const token = tokens[at++];
    if (token === undefined) throw new Error('the guard ended early');
    if (expected !== undefined && token !== expected) throw new Error(`expected ${expected}, read ${token}`);
    return token;
  };

  const parseOr = (): Tri => {
    let value = parseAnd();
    while (peek() === 'or') {
      take('or');
      value = or3(value, parseAnd());
    }
    return value;
  };
  const parseAnd = (): Tri => {
    let value = parseNot();
    while (peek() === 'and') {
      take('and');
      value = and3(value, parseNot());
    }
    return value;
  };
  const parseNot = (): Tri => {
    if (peek() === 'not') {
      take('not');
      return not3(parseNot());
    }
    return parseIs();
  };
  const parseIs = (): Tri => {
    let value = parsePrimary();
    while (peek() === 'is') {
      take('is');
      const negated = peek() === 'not';
      if (negated) take('not');
      if (peek() === 'distinct') {
        take('distinct');
        take('from');
        const other = parsePrimary();
        const distinct = value !== other;
        value = negated ? !distinct : distinct;
        continue;
      }
      const other = parsePrimary();
      const same = value === other;
      value = negated ? !same : same;
    }
    return value;
  };
  const parsePrimary = (): Tri => {
    const token = take();
    if (token === '(') {
      const value = parseOr();
      take(')');
      return value;
    }
    if (token === 'coalesce') {
      take('(');
      const args: Tri[] = [parseOr()];
      while (peek() === ',') {
        take(',');
        args.push(parseOr());
      }
      take(')');
      return args.find((value) => value !== null) ?? null;
    }
    if (token in values) return values[token] as Tri;
    if (token === 'true') return true;
    if (token === 'false') return false;
    if (token === 'null') return null;
    throw new Error(`unsupported token in a plpgsql guard: ${token}`);
  };

  const value = parseOr();
  if (at !== tokens.length) throw new Error('the guard has trailing syntax this cannot read');
  return value;
}

/**
 * Whether plpgsql enters the guarded branch. It takes the branch only when the condition
 * is TRUE, so both FALSE and NULL fall past `end if` to whatever comes next — which in
 * both functions here is the thing the guard existed to prevent.
 */
function branchTaken(guard: string, values: Record<string, Tri>): boolean {
  return evaluateSqlGuard(guard, values) === true;
}

/**
 * What claim_trial does with a given `claimed`. The guarded branch is `return false`, so
 * taking it is a refusal and falling through provisions a trial.
 */
function claimOutcome(guard: string, claimed: Tri): 'refused' | 'granted' {
  return branchTaken(guard, { claimed }) ? 'refused' : 'granted';
}

/**
 * A guard is null-safe only when it fires on NULL as firmly as it fires on false. This
 * is the single predicate behind F73 and F74: both were written `not <flag>` over a flag
 * that RETURNING INTO had just set to NULL.
 */
function guardIsNullSafe(guard: string, variable = 'claimed'): boolean {
  return (
    branchTaken(guard, { [variable]: null }) &&
    branchTaken(guard, { [variable]: false }) &&
    !branchTaken(guard, { [variable]: true })
  );
}

// ------------------------------------------------------------------ rollbacks

interface CreatedObject {
  readonly kind: 'table' | 'index' | 'policy' | 'function' | 'trigger';
  readonly name: string;
  /** What the rollback must contain to count as naming and undoing this object. */
  readonly undone: readonly RegExp[];
}

const escape = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every object a migration creates, read from the migration rather than from a list. */
function createdObjects(sql: string): CreatedObject[] {
  const flat = sql.replace(/\s+/g, ' ');
  const objects: CreatedObject[] = [];

  for (const [, name] of flat.matchAll(/create table (?:if not exists )?(public\.\w+)/gi)) {
    objects.push({ kind: 'table', name: name!, undone: [new RegExp(`drop table if exists ${escape(name!)}`, 'i')] });
  }
  for (const [, name] of flat.matchAll(/create index (?:if not exists )?(\w+)/gi)) {
    objects.push({
      kind: 'index',
      name: name!,
      undone: [new RegExp(`drop index if exists (?:public\\.)?${escape(name!)}`, 'i')],
    });
  }
  for (const [, name, table] of flat.matchAll(/create policy "([^"]+)" on (public\.\w+)/gi)) {
    objects.push({
      kind: 'policy',
      name: `"${name}" on ${table}`,
      undone: [new RegExp(`drop policy if exists "${escape(name!)}" on ${escape(table!)}`, 'i')],
    });
  }
  for (const [, name, args] of flat.matchAll(/create or replace function (public\.\w+)\s*\(([^)]*)\)/gi)) {
    const types = (args ?? '')
      .split(',')
      .map((argument) => argument.trim().split(/\s+/).slice(1).join(' '))
      .filter(Boolean);
    const signature = `${name}(${types.join(', ')})`;
    objects.push({
      kind: 'function',
      name: signature,
      // Either dropped, or restored to its previous definition — both are rollbacks, and
      // a `create or replace` migration can only be undone by one of the two.
      undone: [
        new RegExp(`drop function if exists ${escape(signature)}`, 'i'),
        new RegExp(`create or replace function ${escape(name!)}\\s*\\(`, 'i'),
      ],
    });
  }
  for (const [, name, table] of flat.matchAll(/create trigger (\w+) [\s\S]*?on (public\.\w+)/gi)) {
    objects.push({
      kind: 'trigger',
      name: `${name} on ${table}`,
      undone: [new RegExp(`drop trigger if exists ${escape(name!)} on ${escape(table!)}`, 'i')],
    });
  }

  return objects;
}

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

    // The guard that reads that conflict is asserted on the *effective* body, not on
    // 202608230001. This line used to read `assert.match(hardeningMigration, /if not
    // recorded then/i)`, which pinned F74 in place and would have gone red on the fix —
    // the same mistake databaseContract.test.ts once made about F73.
    assert.match(effectiveBody(FUNCTION_HEADERS.consume_entitlement_session), /on conflict \(session_id\) do nothing/i);
  });

  test('a trial can be claimed only once per pseudonymous installation and user signal', () => {
    assert.match(hardeningMigration, /create table if not exists public\.trial_installations/i);
    assert.match(hardeningMigration, /installation_hash text primary key/i);
    assert.match(hardeningMigration, /first_user_hash text not null unique/i);
    assert.match(hardeningMigration, /alter table public\.trial_installations enable row level security/i);
    assert.match(hardeningMigration, /create or replace function public\.claim_trial/i);
    assert.match(hardeningMigration, /grant execute on function public\.claim_trial\(uuid, text, text\) to service_role/i);
    assert.doesNotMatch(hardeningMigration, /trial_installations[\s\S]{0,300}references auth\.users/i);

    // Both arms of the boundary, and the insert the guard is guarding: one device cannot
    // hand a second account a trial, and one account cannot collect one on a second
    // device. Whether the guard actually refuses is the next test, not this one.
    const body = effectiveClaimTrialBody();
    assert.match(body, /insert into public\.trial_installations \(installation_hash, first_user_hash\)/i);
    assert.match(body, /on conflict do nothing\s+returning true into claimed/i);
    assert.match(trialFixMigration, /grant execute on function public\.claim_trial\(uuid, text, text\) to service_role/i);
    assert.match(trialFixMigration, /revoke all on function public\.claim_trial\(uuid, text, text\) from public, anon, authenticated/i);
  });

  test('the trial claim refuses a second installation rather than falling through on a null', () => {
    const guard = refusalGuard(effectiveClaimTrialBody());

    // A conflicting insert affects zero rows, and RETURNING INTO writes NULL over the
    // `:= false` initialiser. That is the only value that matters on the refusal path.
    assert.equal(claimOutcome(guard, null), 'refused', 'a conflicting claim still provisions a trial (F73)');
    assert.equal(claimOutcome(guard, false), 'refused', 'a false claim still provisions a trial');
    assert.equal(claimOutcome(guard, true), 'granted', 'a genuine first claim is being refused');

    // The evaluator has teeth: run it over the shape this migration exists to replace and
    // it reproduces the defect exactly, which is what makes the assertions above a proof
    // of behaviour rather than a restatement of the file.
    assert.equal(claimOutcome('not claimed', null), 'granted');
    assert.equal(claimOutcome('not claimed', false), 'refused');
    assert.equal(evaluateSqlGuard('not claimed', { claimed: null }), null, 'not NULL must evaluate to NULL, not to true');
    assert.throws(() => evaluateSqlGuard('claimed or pg_is_in_recovery()', { claimed: null }), /unsupported token/);

    // The live behavioural proof of the same sentence, against a real database, is one of
    // the twelve checks in the Supabase harness. This test is the offline half.
    const live = SUPABASE_PROOFS.find(
      (proof) => proof.title === 'the trial claim refuses a second installation rather than falling through on a null',
    );
    assert.ok(live, 'the Supabase harness carries no live proof of the trial refusal');
  });

  test('the contract test rejects the null-unsafe claim_trial guard', () => {
    const effective = effectiveClaimTrialBody();
    assert.match(effective, /if\s+claimed is not true\s+then\s+return false;/i);
    assert.doesNotMatch(effective, /if\s+not\s+claimed\s+then/i, 'the null-unsafe guard is back in the migrations');
    assert.ok(guardIsNullSafe(refusalGuard(effective)), 'the effective claim_trial guard is not null-safe');

    // The rejection is real, not incidental: the 202608230001 body is still on disk, and
    // this same check must call it unsafe. A test that cannot fail defends nothing.
    const historic = hardeningMigration.match(/create or replace function public\.claim_trial[\s\S]*?as \$\$([\s\S]*?)\$\$;/i);
    assert.ok(historic?.[1], 'the original claim_trial definition is missing from migration history');
    assert.equal(guardIsNullSafe(refusalGuard(historic[1])), false, 'the historic null-unsafe guard was judged safe');
    for (const unsafe of ['not claimed', 'claimed is false', 'not (claimed)', 'claimed is distinct from true and claimed is not null']) {
      assert.equal(guardIsNullSafe(unsafe), false, `${unsafe} refuses a conflicting claim only by accident`);
    }
    for (const safe of ['claimed is not true', 'not coalesce(claimed, false)', 'claimed is distinct from true']) {
      assert.equal(guardIsNullSafe(safe), true, `${safe} is null-safe and should be accepted`);
    }

    // Forward-only: the fix replaces one function body and rewrites no history. It is a
    // later file than the migration it corrects, that migration still carries its defect
    // verbatim, and nothing after it re-defines claim_trial.
    assert.ok(migrationFiles.includes('202608240001_claim_trial_null_fix.sql'));
    assert.ok(
      migrationFiles.indexOf('202608240001_claim_trial_null_fix.sql') >
        migrationFiles.indexOf('202608230001_session_usage_idempotency.sql'),
      'the claim_trial fix does not come after the migration it corrects',
    );
    assert.doesNotMatch(stripComments(trialFixMigration), /drop table|alter table|delete from|truncate/i);
    assert.match(trialFixMigration, /create or replace function public\.claim_trial/i);
    const laterClaimTrial = migrationFiles
      .slice(migrationFiles.indexOf('202608240001_claim_trial_null_fix.sql') + 1)
      .filter((name) => FUNCTION_HEADERS.claim_trial.test(sqlOf(name)));
    assert.deepEqual(laterClaimTrial, [], 'a later migration re-defines claim_trial without being read here');
  });

  test('the session debit bills a replayed session id once rather than falling through on a null', () => {
    const body = effectiveBody(FUNCTION_HEADERS.consume_entitlement_session);
    const guard = idempotencyGuard(body);

    // F74, and the same three-valued reading as F73. `insert ... on conflict (session_id)
    // do nothing returning true into recorded` assigns NULL when the insert affects zero
    // rows, so NULL is the only value that matters on the replay path. Falling through
    // means the debit UPDATE runs and the learner is billed for the same session twice.
    assert.ok(guardIsNullSafe(guard, 'recorded'), `the idempotency guard is not null-safe: ${guard}`);
    assert.equal(branchTaken(guard, { recorded: null }), true, 'a replayed session id is billed again (F74)');
    assert.equal(branchTaken(guard, { recorded: false }), true, 'a conflicting report is billed again');
    assert.equal(branchTaken(guard, { recorded: true }), false, 'a genuine first report is treated as a replay');
    assert.doesNotMatch(stripComments(body), /if\s+not\s+recorded\s+then/i, 'the null-unsafe guard is back');

    // Teeth. The 202608230001 body is still on disk and this same reading must call it
    // unsafe, or the assertions above are a restatement of the file rather than a proof.
    const historic = hardeningMigration.match(
      /create or replace function public\.consume_entitlement\(\s*p_user_id uuid,\s*p_seconds integer,\s*p_session_id uuid\s*\)[\s\S]*?as \$\$([\s\S]*?)\$\$;/i,
    );
    assert.ok(historic?.[1], 'the original session-aware debit is missing from migration history');
    assert.equal(guardIsNullSafe(idempotencyGuard(historic[1]), 'recorded'), false, 'the historic guard was judged safe');
    assert.equal(
      branchTaken(idempotencyGuard(historic[1]), { recorded: null }),
      false,
      'the historic guard must fall through on NULL, which is what F74 was',
    );

    // Both arms of the boundary live inside that branch, so both were dead while it was
    // unreachable: the replay no-op and the cross-account refusal.
    assert.match(body, /recorded_user is distinct from p_user_id/i);
    assert.match(body, /raise exception 'session id already belongs to another account'/i);
    assert.match(body, /on conflict \(session_id\) do nothing\s+returning true into recorded/i);

    // The concurrent case is named rather than mislabelled: `on conflict do nothing`
    // skips an uncommitted duplicate without blocking, so the follow-up select can find
    // nothing, and that is not a cross-account collision.
    assert.match(body, /if not found then\s+raise exception 'session id is being reported concurrently'/i);

    // Forward-only, and the live behavioural halves are in the harness inventory.
    assert.ok(migrationFiles.includes('202608250001_consume_entitlement_null_fix.sql'));
    assert.ok(
      migrationFiles.indexOf('202608250001_consume_entitlement_null_fix.sql') >
        migrationFiles.indexOf('202608230001_session_usage_idempotency.sql'),
      'the debit fix does not come after the migration it corrects',
    );
    assert.doesNotMatch(stripComments(debitFixMigration), /drop table|alter table|delete from|truncate|drop function/i);
    assert.match(
      debitFixMigration,
      /grant execute on function public\.consume_entitlement\(uuid, integer, uuid\) to service_role/i,
    );
    assert.match(
      debitFixMigration,
      /revoke all on function public\.consume_entitlement\(uuid, integer, uuid\) from public, anon, authenticated/i,
    );
    for (const id of ['session-replay', 'cross-user-session-refused']) {
      assert.ok(
        SUPABASE_PROOFS.some((proof) => proof.id === id),
        `the Supabase harness carries no live proof called ${id}`,
      );
    }
  });

  test('the product event trigger counts properties with a function Postgres actually has', () => {
    const body = effectiveBody(FUNCTION_HEADERS.validate_product_event);

    // F75. `jsonb_object_length` does not exist in any version of PostgreSQL, and
    // plpgsql binds function calls late, so the migration applied clean and every insert
    // raised 42883 at run time — from the client under RLS and from the service role
    // alike, because service role bypasses RLS and not triggers.
    assert.doesNotMatch(stripComments(body), /jsonb_object_length/i, 'the trigger calls a function Postgres does not have');
    assert.match(body, /jsonb_object_keys\(new\.properties\)/i);
    assert.match(body, /select count\(\*\) into property_count/i);

    // The shape guard has to run before the count: jsonb_object_keys raises 22023 on an
    // array or a scalar, and product_events' own CHECK runs after this BEFORE ROW trigger.
    const shapeAt = body.search(/jsonb_typeof\(new\.properties\) <> 'object'/i);
    const countAt = body.search(/jsonb_object_keys/i);
    assert.ok(shapeAt >= 0, 'the trigger never checks that properties is an object');
    assert.ok(shapeAt < countAt, 'the property count runs before the shape guard that makes it safe');
    assert.match(body, /new\.properties is null or/i, 'the shape guard is not null-safe, which is F73 all over again');

    // Teeth: the historic definition is still on disk and must still be recognised.
    assert.match(hardeningMigration, /jsonb_object_length\(new\.properties\)/i);

    // The fix swaps the body underneath the live trigger. Re-issuing drop/create trigger
    // would open a window in which product_events has no validation at all.
    assert.doesNotMatch(stripComments(eventFixMigration), /create trigger|drop trigger/i);
    assert.doesNotMatch(stripComments(eventFixMigration), /drop table|alter table|delete from|truncate/i);
    assert.match(eventFixMigration, /revoke all on function public\.validate_product_event\(\) from public, anon, authenticated/i);
    assert.ok(
      migrationFiles.indexOf('202608250002_product_event_key_count_fix.sql') >
        migrationFiles.indexOf('202608230001_session_usage_idempotency.sql'),
      'the trigger fix does not come after the migration it corrects',
    );
    assert.ok(
      SUPABASE_PROOFS.some((proof) => proof.id === 'product-event-trigger'),
      'the Supabase harness carries no live proof of the product event trigger',
    );
  });

  test('every migration ships a rollback that names each object it created', () => {
    const rollbackFiles = readdirSync(ROLLBACKS).filter((name) => name.endsWith('.sql'));
    assert.ok(migrationFiles.length > 0, 'there are no migrations to roll back');

    for (const file of migrationFiles) {
      const stamp = file.split('_')[0];
      const rollbackName = `${stamp}_down.sql`;
      assert.ok(rollbackFiles.includes(rollbackName), `${file} has no rollback at supabase/rollback/${rollbackName}`);
      const rollback = readFileSync(path.join(ROLLBACKS, rollbackName), 'utf8');
      const objects = createdObjects(sqlOf(file));
      assert.ok(objects.length > 0, `${file} appears to create nothing, which cannot be right`);
      for (const object of objects) {
        assert.ok(
          object.undone.some((pattern) => pattern.test(rollback)),
          `${rollbackName} never undoes the ${object.kind} ${object.name} that ${file} created`,
        );
      }
    }

    // No orphan rollbacks either: a down-script with no migration is a script nobody can
    // reason about, and the pairing is what makes "rollback evidence" writable at all.
    for (const rollbackName of rollbackFiles) {
      const stamp = rollbackName.replace(/_down\.sql$/, '');
      assert.ok(
        migrationFiles.some((file) => file.startsWith(`${stamp}_`)),
        `supabase/rollback/${rollbackName} rolls back a migration that does not exist`,
      );
    }

    // Two rollbacks are dangerous in ways a filename cannot carry, so they say so.
    const trialLedger = readFileSync(path.join(ROLLBACKS, '202608230001_down.sql'), 'utf8');
    assert.match(trialLedger, /DESTRUCTIVE/);
    assert.match(trialLedger, /trial_installations is pseudonymous antifraud evidence/i);
    const reopensF73 = readFileSync(path.join(ROLLBACKS, '202608240001_down.sql'), 'utf8');
    assert.match(reopensF73, /REOPENS-F73/);
    assert.match(reopensF73, /parle\.reopen_f73/);
    assert.match(reopensF73, /raise exception\s*\n?\s*'refusing to restore the NULL-unsafe claim_trial guard/i);
  });

  test('the supabase runbook applies every migration in order and pairs each with its rollback', () => {
    const readme = readFileSync(path.join(ROOT, 'supabase', 'README.md'), 'utf8');
    let previous = -1;
    for (const file of migrationFiles) {
      const at = readme.indexOf(file);
      assert.ok(at > previous, `supabase/README.md does not list ${file} in apply order`);
      previous = at;
      assert.match(readme, new RegExp(escape(`rollback/${file.split('_')[0]}_down.sql`)));
    }
    for (const heading of ['## Apply', '## Backup', '## Restore', '## Rollback evidence']) {
      assert.ok(readme.includes(heading), `supabase/README.md has no ${heading} section`);
    }
    assert.match(readme, /verify\/supabaseLive\.ts/, 'the runbook does not say how to verify the result');
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

    // Every branch is asserted on the *effective* body. This test used to read
    // `assert.match(hardeningMigration, /jsonb_object_length\(new\.properties\)/i)`,
    // which pinned a call Postgres does not have and reported it as coverage (F75).
    const body = effectiveBody(FUNCTION_HEADERS.validate_product_event);
    for (const name of [
      'onboarding_completed',
      'mission_started',
      'mission_completed',
      'sound_check_completed',
      'my_french_opened',
    ]) {
      assert.match(body, new RegExp(`new\\.name = '${name}'`, 'i'));
    }
    assert.match(body, /else\s+raise exception 'unsupported product event'/i);

    // The trigger itself is still created exactly once, by the migration that made the
    // table's validation a database concern rather than an API one.
    assert.match(hardeningMigration, /before insert or update on public\.product_events/i);
  });

  test('the initial migration still owns the tables the later ones depend on', () => {
    for (const table of ['learner_state', 'product_events', 'entitlements']) {
      assert.match(initialMigration, new RegExp(`create table if not exists public\\.${table}`, 'i'));
    }
  });
});
