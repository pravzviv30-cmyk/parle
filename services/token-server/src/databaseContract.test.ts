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
  record_billing_event: /create or replace function public\.record_billing_event\b/i,
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

// ------------------------------------------------------- product event layers

/** The migration that made `onboarding_completed` a one-property event (F116). */
const ONBOARDING_FIX = '202608270001_onboarding_event_property_fix.sql';

/** Every event name the three validation layers are supposed to agree about. */
const PRODUCT_EVENTS = [
  'onboarding_completed',
  'mission_started',
  'mission_completed',
  'sound_check_completed',
  'my_french_opened',
] as const;

/** The token server's own copy of the allowlist, read as source rather than executed. */
const parserSource = readFileSync(path.join(import.meta.dirname, 'productEvents.ts'), 'utf8');

/** One `if new.name = '<event>' then ...` branch of the trigger body, comments removed. */
function triggerBranch(body: string, event: string): string {
  const start = body.search(new RegExp(`new\\.name = '${event}'`, 'i'));
  assert.ok(start >= 0, `the trigger has no branch for ${event}`);
  const rest = stripComments(body.slice(start));
  const end = rest.search(/\belsif\b|\belse\b/i);
  return end > 0 ? rest.slice(0, end) : rest;
}

/** The keys one trigger branch requires, read from its `?& array[...]`. */
function requiredKeys(sql: string, what: string): string[] {
  const list = sql.match(/\?&\s*array\[([^\]]*)\]/);
  assert.ok(list?.[1], `${what} requires no key set at all`);
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]!).sort();
}

/** The keys parseProductEvent requires for one event, read from its `exactKeys` call. */
function parserKeys(event: string): string[] {
  const start = parserSource.search(new RegExp(`candidate\\.name === '${event}'`));
  assert.ok(start >= 0, `parseProductEvent has no branch for ${event}`);
  const list = parserSource.slice(start).match(/exactKeys\(properties, \[([^\]]*)\]\)/);
  assert.ok(list?.[1], `parseProductEvent's ${event} branch does not name an exact key list`);
  return [...list[1].matchAll(/'([^']+)'/g)].map((match) => match[1]!).sort();
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

// ------------------------------------------------------- the billing event ledger

/** F244's table and recorder, and F245's forward fix, by the names the runbook pastes. */
const BILLING_EVENTS = '202608300001_billing_events.sql';
const LAPSE_FIX = '202608300002_paid_period_lapse.sql';

/**
 * The condition record_billing_event puts on the branch that follows its conflicting
 * `insert ... returning true into recorded` — the branch that reports a replay.
 *
 * Deliberately the same reading as idempotencyGuard above rather than a second one: F73
 * and F74 were one defect written twice, and a third money function is exactly where it
 * would be written a third time.
 */
function sightingGuard(body: string): string {
  const guard = stripComments(body).match(/returning true into recorded;\s*if\s+([\s\S]+?)\s+then\b/i);
  assert.ok(guard?.[1], 'record_billing_event has no guard after the ledger insert');
  return guard[1].replace(/\s+/g, ' ').trim();
}

/**
 * What record_billing_event tells its caller for a given `recorded`. The guarded branch
 * returns false — "seen before" — so falling through reports a first sighting, and F248
 * fetches the subscriber again and reprojects the entitlement off a webhook it has
 * already acted on.
 */
function sightingOutcome(guard: string, recorded: Tri): 'replay' | 'first-sighting' {
  return branchTaken(guard, { recorded }) ? 'replay' : 'first-sighting';
}

// ------------------------------------------- the debit's UPDATE, actually evaluated

interface SqlInterval {
  readonly ms: number;
}
type SqlValue = string | number | boolean | Date | SqlInterval | null;

const isInterval = (value: SqlValue): value is SqlInterval =>
  typeof value === 'object' && value !== null && !(value instanceof Date) && 'ms' in value;

const INTERVAL_MS: Record<string, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

/** `interval '24 hours'` as milliseconds. Unknown units throw rather than count as zero. */
function intervalOf(literal: string): SqlInterval {
  const parts = literal.match(/^(\d+)\s+(minute|hour|day)s?$/i);
  if (!parts) throw new Error(`unsupported interval literal: ${literal}`);
  return { ms: Number(parts[1]) * INTERVAL_MS[parts[2]!.toLowerCase()]! };
}

/** Postgres comparison, three-valued: anything compared with NULL is unknown. */
function compareSql(operator: string, left: SqlValue, right: SqlValue): Tri {
  if (left === null || right === null) return null;
  const scalar = (value: SqlValue): string | number =>
    value instanceof Date ? value.getTime() : typeof value === 'boolean' ? Number(value) : (value as string | number);
  const a = scalar(left);
  const b = scalar(right);
  switch (operator) {
    case '=':
      return a === b;
    case '<>':
      return a !== b;
    case '<':
      return a < b;
    case '<=':
      return a <= b;
    case '>':
      return a > b;
    case '>=':
      return a >= b;
    default:
      throw new Error(`unsupported comparison: ${operator}`);
  }
}

/**
 * Evaluate one expression out of the debit's UPDATE against a row.
 *
 * The point is the same as evaluateSqlGuard's: read what the migration will actually do
 * rather than what its text looks like. F245 was a `case` arm that renewed a paid period
 * the billing system never sold, and no string assertion distinguishes that from the arm
 * that refuses to. Unknown syntax throws rather than evaluating to something convenient.
 */
function evaluateSqlExpression(expression: string, row: Record<string, SqlValue>): SqlValue {
  const tokens = expression.match(/'[^']*'|[a-zA-Z_][a-zA-Z0-9_]*|\d+|<>|<=|>=|[(),+\-=<>]/g) ?? [];
  let at = 0;
  const peek = (): string | undefined => tokens[at]?.toLowerCase();
  const take = (expected?: string): string => {
    const token = tokens[at++];
    if (token === undefined) throw new Error('the expression ended early');
    if (expected !== undefined && token.toLowerCase() !== expected) throw new Error(`expected ${expected}, read ${token}`);
    return token;
  };

  const parseOr = (): SqlValue => {
    let value = parseAnd();
    while (peek() === 'or') {
      take('or');
      value = or3(value as Tri, parseAnd() as Tri);
    }
    return value;
  };
  const parseAnd = (): SqlValue => {
    let value = parseComparison();
    while (peek() === 'and') {
      take('and');
      value = and3(value as Tri, parseComparison() as Tri);
    }
    return value;
  };
  const parseComparison = (): SqlValue => {
    let value = parseAdditive();
    for (;;) {
      const token = peek();
      if (token === 'is') {
        take('is');
        const negated = peek() === 'not';
        if (negated) take('not');
        take('null');
        const same = value === null;
        value = negated ? !same : same;
        continue;
      }
      if (token === '=' || token === '<>' || token === '<' || token === '<=' || token === '>' || token === '>=') {
        take();
        value = compareSql(token, value, parseAdditive());
        continue;
      }
      return value;
    }
  };
  const parseAdditive = (): SqlValue => {
    let value = parsePrimary();
    while (peek() === '+' || peek() === '-') {
      const operator = take();
      const right = parsePrimary();
      if (value === null || right === null) {
        value = null;
      } else if (value instanceof Date && isInterval(right)) {
        value = new Date(value.getTime() + (operator === '+' ? right.ms : -right.ms));
      } else if (typeof value === 'number' && typeof right === 'number') {
        value = operator === '+' ? value + right : value - right;
      } else {
        throw new Error(`unsupported arithmetic: ${String(value)} ${operator} ${String(right)}`);
      }
    }
    return value;
  };
  const parseCase = (): SqlValue => {
    take('case');
    const searched = peek() === 'when';
    const operand = searched ? null : parseAdditive();
    const branches: [SqlValue, SqlValue][] = [];
    while (peek() === 'when') {
      take('when');
      const test = searched ? parseOr() : parseAdditive();
      take('then');
      branches.push([test, parseOr()]);
    }
    let fallback: SqlValue = null;
    if (peek() === 'else') {
      take('else');
      fallback = parseOr();
    }
    take('end');
    for (const [test, result] of branches) {
      // A CASE arm is taken only when its condition is TRUE, so NULL falls through it
      // exactly as FALSE does — the same rule that made F73 and F74 possible.
      const hit = searched ? test === true : compareSql('=', operand, test) === true;
      if (hit) return result;
    }
    return fallback;
  };
  const parsePrimary = (): SqlValue => {
    const token = take();
    const keyword = token.toLowerCase();
    if (token === '(') {
      const value = parseOr();
      take(')');
      return value;
    }
    if (token.startsWith("'")) return token.slice(1, -1);
    if (/^\d+$/.test(token)) return Number(token);
    if (keyword === 'null') return null;
    if (keyword === 'true') return true;
    if (keyword === 'false') return false;
    if (keyword === 'case') {
      at -= 1;
      return parseCase();
    }
    if (keyword === 'now') {
      take('(');
      take(')');
      const now = row['now'];
      assert.ok(now instanceof Date, 'the expression calls now() with no clock bound to read it against');
      return now;
    }
    if (keyword === 'interval') {
      const literal = take();
      return intervalOf(literal.slice(1, -1));
    }
    if (keyword === 'least') {
      take('(');
      const args: SqlValue[] = [parseOr()];
      while (peek() === ',') {
        take(',');
        args.push(parseOr());
      }
      take(')');
      const numbers = args.filter((value): value is number => typeof value === 'number');
      return numbers.length === 0 ? null : Math.min(...numbers);
    }
    if (keyword in row) return row[keyword]!;
    throw new Error(`unsupported token in a debit expression: ${token}`);
  };

  const value = parseOr();
  if (at !== tokens.length) throw new Error(`the expression has trailing syntax this cannot read: ${tokens.slice(at).join(' ')}`);
  return value;
}

/** Every `column = expression` of the debit's UPDATE, in the order it assigns them. */
function debitAssignments(body: string): [string, string][] {
  const sql = stripComments(body);
  const at = sql.lastIndexOf('update public.entitlements');
  assert.ok(at >= 0, 'the debit never updates public.entitlements');
  const rest = sql.slice(at);
  const setAt = rest.search(/\bset\b/i);
  const whereAt = rest.search(/\bwhere user_id = p_user_id\b/i);
  assert.ok(setAt >= 0 && whereAt > setAt, 'the debit UPDATE has no set ... where clause to read');

  const clause = rest.slice(setAt + 'set'.length, whereAt);
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let index = 0; index < clause.length; index += 1) {
    const character = clause[index];
    if (character === '(') depth += 1;
    else if (character === ')') depth -= 1;
    else if (character === ',' && depth === 0) {
      parts.push(clause.slice(start, index));
      start = index + 1;
    }
  }
  parts.push(clause.slice(start));

  return parts.map((part) => {
    const assignment = part.match(/^\s*(\w+)\s*=\s*([\s\S]+?)\s*$/);
    assert.ok(assignment?.[1] && assignment[2], `the debit UPDATE has an assignment this cannot read: ${part.trim()}`);
    return [assignment[1], assignment[2]] as [string, string];
  });
}

interface EntitlementRow {
  readonly plan: string;
  readonly seconds_used: number;
  readonly period_end: Date | null;
}

/**
 * The row a debit leaves behind, evaluated from the migration's own SQL.
 *
 * Every assignment reads the row as it was before the statement, which is what Postgres
 * does and what makes the lapse readable at all: `plan` in the seconds arm is still the
 * paid plan while the plan arm is turning it into a trial.
 */
function applyDebit(body: string, row: EntitlementRow, seconds: number, now: Date): EntitlementRow {
  const bindings: Record<string, SqlValue> = {
    plan: row.plan,
    seconds_used: row.seconds_used,
    period_end: row.period_end,
    p_seconds: seconds,
    now,
  };
  const applied = new Map<string, SqlValue>();
  for (const [column, expression] of debitAssignments(body)) {
    if (column === 'updated_at') continue;
    applied.set(column, evaluateSqlExpression(expression, bindings));
  }
  const read = (column: string, fallback: SqlValue): SqlValue => (applied.has(column) ? applied.get(column)! : fallback);

  const plan = read('plan', row.plan);
  const used = read('seconds_used', row.seconds_used);
  const end = read('period_end', row.period_end);
  assert.equal(typeof plan, 'string', `the debit left plan as ${String(plan)}`);
  assert.equal(typeof used, 'number', `the debit left seconds_used as ${String(used)}`);
  assert.ok(end === null || end instanceof Date, `the debit left period_end as ${String(end)}`);
  return { plan: plan as string, seconds_used: used as number, period_end: end as Date | null };
}

/** The plan allowance table as core knows it, in the shape the SQL writes it. */
const CORE_CAPS: Record<string, number> = Object.fromEntries(
  Object.values(PLANS).map((plan) => [plan.id, plan.secondsPerPeriod]),
);

/** Every `case plan when '<plan>' then <seconds> ... end` in one file. */
function planCapCases(sql: string): Record<string, number>[] {
  return [...stripComments(sql).matchAll(/case plan\s+((?:when '\w+' then \d+\s+)+)(?:else \d+\s+)?end/gi)].map(
    ([, arms]) =>
      Object.fromEntries([...arms!.matchAll(/when '(\w+)' then (\d+)/gi)].map((arm) => [arm[1]!, Number(arm[2])])),
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

    // Every copy, not one of them. `migration` is all the files joined together, so the
    // loop above is satisfied by a single matching allowance table anywhere in the
    // history while a later one quietly disagrees — and F245's forward fix writes a
    // fourth copy into the migrations and a fifth into its own rollback.
    const files: [string, string][] = [
      ...migrationFiles.map((name): [string, string] => [`migrations/${name}`, sqlOf(name)]),
      ...readdirSync(ROLLBACKS)
        .filter((name) => name.endsWith('.sql'))
        .map((name): [string, string] => [`rollback/${name}`, readFileSync(path.join(ROLLBACKS, name), 'utf8')]),
    ];
    let copies = 0;
    for (const [name, sql] of files) {
      for (const caps of planCapCases(sql)) {
        copies += 1;
        assert.deepEqual(caps, CORE_CAPS, `${name} carries an allowance table that disagrees with PLANS`);
      }
    }
    assert.ok(copies >= 4, `only ${copies} allowance tables were read, so this is checking less than it looks`);

    // And the body a database actually ends up with carries exactly one of them.
    assert.deepEqual(planCapCases(effectiveBody(FUNCTION_HEADERS.consume_entitlement_session)), [CORE_CAPS]);
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

  test('a replayed billing event id is refused in three-valued logic', () => {
    assert.ok(migrationFiles.includes(BILLING_EVENTS), `supabase/migrations is missing ${BILLING_EVENTS}`);
    const body = effectiveBody(FUNCTION_HEADERS.record_billing_event);
    const guard = sightingGuard(body);

    // F244, written with F73 and F74 already paid for. `insert ... on conflict (event_id)
    // do nothing returning true into recorded` assigns NULL when the insert affects zero
    // rows, so NULL is the only value that matters on the replay path. Falling through
    // means a webhook we have already acted on is reported as new, and F248 fetches the
    // subscriber and reprojects the entitlement off it a second time.
    assert.match(stripComments(body), /on conflict \(event_id\) do nothing\s+returning true into recorded/i);
    assert.ok(guardIsNullSafe(guard, 'recorded'), `the replay guard is not null-safe: ${guard}`);
    assert.equal(sightingOutcome(guard, null), 'replay', 'a replayed billing event is reported as a first sighting');
    assert.equal(sightingOutcome(guard, false), 'replay', 'a conflicting record is reported as a first sighting');
    assert.equal(sightingOutcome(guard, true), 'first-sighting', 'a genuinely new event is reported as a replay');
    assert.match(stripComments(body), /if\s+recorded is not true\s+then/i);
    assert.doesNotMatch(stripComments(body), /if\s+not\s+recorded\s+then/i, 'the null-unsafe guard is back');

    // Teeth. The other two money functions have a defective body still on disk to be
    // condemned; this one was written correctly the first time, so the counterfactual is
    // made from the real body by the single substitution that turns it back into F74. The
    // same reading must call that unsafe, or the assertions above are a restatement of
    // the file rather than a proof of its behaviour.
    const written = stripComments(body);
    const unsafe = written.replace(/recorded is not true/i, 'not recorded');
    assert.notEqual(unsafe, written, 'the null-unsafe counterfactual changed nothing, so it proves nothing');
    assert.equal(guardIsNullSafe(sightingGuard(unsafe), 'recorded'), false, 'the null-unsafe guard was judged safe');
    assert.equal(
      sightingOutcome(sightingGuard(unsafe), null),
      'first-sighting',
      'the null-unsafe guard must fall through on NULL, which is what F73 and F74 both were',
    );
    assert.equal(evaluateSqlGuard('not recorded', { recorded: null }), null, 'not NULL must evaluate to NULL, not to true');

    // Forward-only and bounded: a new table and a new function, no existing object
    // altered, and nothing here rewrites a migration that has already been pasted.
    const sql = sqlOf(BILLING_EVENTS);
    assert.doesNotMatch(stripComments(sql), /alter table public\.(entitlements|session_usage|learner_state|product_events)/i);
    assert.doesNotMatch(stripComments(sql), /drop table|delete from|truncate|drop function/i);
    assert.match(sql, /create table if not exists public\.billing_events/i);
  });

  test('billing_events has no client policies and only the service role may record', () => {
    const sql = sqlOf(BILLING_EVENTS);

    // The session_usage precedent exactly: RLS on, no policy, and every client role
    // revoked, so the only way in is the service-role function. RLS with no policy denies
    // by default, and the revoke is the belt to that braces.
    assert.match(sql, /event_id text primary key/i);
    assert.match(sql, /user_id uuid not null references auth\.users\(id\) on delete cascade/i);
    assert.match(sql, /alter table public\.billing_events enable row level security/i);
    assert.match(sql, /revoke all on table public\.billing_events from public, anon, authenticated/i);
    assert.doesNotMatch(stripComments(sql), /create policy/i, 'the billing ledger has a client policy');
    assert.doesNotMatch(
      stripComments(migration),
      /on public\.billing_events for (select|insert|update|delete)/i,
      'some migration gives a client a policy on the billing ledger',
    );
    assert.doesNotMatch(stripComments(hardeningMigration), /create policy[^;]*public\.session_usage/i);

    // The recorder is the same shape as the debit: security definer with a fixed search
    // path, unavailable to every client role, executable only by the server.
    assert.match(sql, /create or replace function public\.record_billing_event/i);
    assert.match(sql, /security definer\s+set search_path = ''/i);
    assert.match(sql, /revoke all on function public\.record_billing_event\(text, uuid\) from public, anon, authenticated/i);
    assert.match(sql, /grant execute on function public\.record_billing_event\(text, uuid\) to service_role/i);

    // Nothing about a payment is worth a transcript. The ledger carries an id, an owner,
    // a type and a timestamp, and the runbook's rule about speech holds here too.
    assert.doesNotMatch(stripComments(sql), /transcript|audio|\bemail\b/i);
    const columns = sql.match(/create table if not exists public\.billing_events \(([\s\S]*?)\n\);/i);
    assert.ok(columns?.[1], 'the billing ledger has no readable column list');
    assert.deepEqual(
      [...columns[1].matchAll(/^\s{2}(\w+)\s/gm)].map((column) => column[1]),
      ['event_id', 'user_id', 'event_type', 'received_at'],
      'the billing ledger carries a column the contract never agreed to',
    );
  });

  test('an expired paid period lapses to an exhausted trial instead of renewing itself', () => {
    assert.ok(migrationFiles.includes(LAPSE_FIX), `supabase/migrations is missing ${LAPSE_FIX}`);
    const body = effectiveBody(FUNCTION_HEADERS.consume_entitlement_session);
    const now = new Date('2026-09-15T12:00:00.000Z');
    const hours = (count: number): Date => new Date(now.getTime() + count * 3_600_000);
    const expired: EntitlementRow = { plan: 'starter', seconds_used: 9000, period_end: hours(-48) };

    // F245. The lazy roll reset the counter and added thirty days to any paid period that
    // had ended — on every debit and, since get() is a zero-second debit, on every read.
    // Nothing sells yet, so nothing has lapsed yet; the day a subscription is cancelled,
    // this is our own database forging paid status for a learner who stopped paying.
    assert.deepEqual(
      applyDebit(body, expired, 60, now),
      { plan: 'trial', seconds_used: PLANS.trial.secondsPerPeriod, period_end: null },
      'an expired paid period does not lapse to an exhausted trial',
    );

    // Teeth. 202608250001's body is still on disk, unrewritten, and the same evaluation
    // must reproduce the grant it makes: thirty free days and a cleared counter.
    const historic = debitFixMigration.match(
      /create or replace function public\.consume_entitlement\([\s\S]*?as \$\$([\s\S]*?)\$\$;/i,
    );
    assert.ok(historic?.[1], 'the shipped consume_entitlement is missing from migration history');
    const renewed = applyDebit(historic[1], expired, 60, now);
    assert.equal(renewed.plan, 'starter', 'the historic body was expected to keep the paid plan');
    assert.equal(renewed.seconds_used, 60, 'the historic body was expected to clear the counter');
    assert.deepEqual(
      renewed.period_end,
      new Date(now.getTime() + 30 * 86_400_000),
      'the historic body was expected to grant thirty free days, which is what F245 is',
    );

    // The 24 hour slack is for webhook delay and clock skew, so a period that ended an
    // hour ago is not lapsed and is not renewed either: it keeps its end date and its
    // counter keeps counting. The historic body cleared that counter to 60.
    assert.deepEqual(
      applyDebit(body, { plan: 'starter', seconds_used: 9000, period_end: hours(-1) }, 60, now),
      { plan: 'starter', seconds_used: 9060, period_end: hours(-1) },
      'a period one hour past its end is already being lapsed or renewed',
    );
    assert.equal(applyDebit(historic[1], { plan: 'starter', seconds_used: 9000, period_end: hours(-1) }, 60, now).seconds_used, 60);

    // The boundary itself, both sides of it.
    assert.equal(applyDebit(body, { ...expired, period_end: hours(-24) }, 60, now).plan, 'starter');
    assert.equal(
      applyDebit(body, { ...expired, period_end: new Date(now.getTime() - 24 * 3_600_000 - 1) }, 60, now).plan,
      'trial',
    );

    // A live period is untouched, and a trial still never renews and still caps.
    assert.deepEqual(
      applyDebit(body, { plan: 'regular', seconds_used: 600, period_end: hours(240) }, 60, now),
      { plan: 'regular', seconds_used: 660, period_end: hours(240) },
    );
    assert.deepEqual(
      applyDebit(body, { plan: 'trial', seconds_used: 1700, period_end: null }, 200, now),
      { plan: 'trial', seconds_used: PLANS.trial.secondsPerPeriod, period_end: null },
    );

    // A paid row with no period at all is the same defect wearing a different shape: the
    // database has no evidence of a paid period, so it invents neither one nor a lapse.
    // Revoking a paying learner on a row we cannot read would be the worse error.
    assert.deepEqual(
      applyDebit(body, { plan: 'starter', seconds_used: 100, period_end: null }, 60, now),
      { plan: 'starter', seconds_used: 160, period_end: null },
      'the debit invents a paid period for a row that carries none',
    );
    assert.deepEqual(
      applyDebit(historic[1], { plan: 'starter', seconds_used: 100, period_end: null }, 60, now).period_end,
      new Date(now.getTime() + 30 * 86_400_000),
    );

    // No arm of the live debit adds time to now(). That single sentence is the whole fix,
    // and it is the one a later edit would most plausibly undo.
    assert.doesNotMatch(stripComments(body), /now\(\) \+ interval/i, 'the debit grants paid time the billing system did not');
    assert.match(stripComments(debitFixMigration), /now\(\) \+ interval '30 days'/i, 'the defect has been edited out of history');

    // Forward-only, and the same replay and ownership guarantees still stand in the body
    // this migration replaces: F74 is not reopened by the file that closes F245.
    assert.ok(
      migrationFiles.indexOf(LAPSE_FIX) > migrationFiles.indexOf('202608250001_consume_entitlement_null_fix.sql'),
      'the lapse fix does not come after the migration it corrects',
    );
    assert.ok(guardIsNullSafe(idempotencyGuard(body), 'recorded'), 'the lapse fix dropped F74 idempotency guard');
    assert.match(body, /raise exception 'session id already belongs to another account'/i);
    assert.match(body, /raise exception 'session id is being reported concurrently'/i);
    const lapseFix = sqlOf(LAPSE_FIX);
    assert.doesNotMatch(stripComments(lapseFix), /drop table|alter table|delete from|truncate|drop function/i);
    assert.match(lapseFix, /revoke all on function public\.consume_entitlement\(uuid, integer, uuid\) from public, anon, authenticated/i);
    assert.match(lapseFix, /grant execute on function public\.consume_entitlement\(uuid, integer, uuid\) to service_role/i);
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

  test('the product event trigger asks onboarding for the one property the client still sends', () => {
    const body = effectiveBody(FUNCTION_HEADERS.validate_product_event);
    const branch = triggerBranch(body, 'onboarding_completed');

    // F116. The why page left the first run, so the client union dropped
    // `motivationAnswered` and sends `{ personalisedGreeting }` alone. Typecheck forced
    // the client's half of that decision and nothing forced this one, so the database
    // went on demanding both keys and refused every onboarding_completed — silently,
    // because the token server turns the write failure into a 500 and
    // apps/mobile/src/analytics/track.ts swallows it by design.
    assert.deepEqual(requiredKeys(branch, 'the onboarding_completed branch'), ['personalisedGreeting']);
    assert.doesNotMatch(branch, /motivationAnswered/i, 'the trigger still demands the retired why-page property');
    assert.doesNotMatch(stripComments(body), /motivationAnswered/i, 'motivationAnswered survives elsewhere in the trigger');
    assert.match(branch, /jsonb_typeof\(new\.properties->'personalisedGreeting'\) <> 'boolean'/i);

    // Exact, not a subset. `?&` on its own would accept
    // { personalisedGreeting, transcript }, and the count is the only thing standing
    // between an allowlist and a smuggled field.
    assert.match(branch, /property_count <> 1\b/i, 'the onboarding branch still counts a key set it no longer has');

    // Forward-only, with teeth: 202608250002 keeps the two-key guard it deployed, and
    // the fix is a later file that replaces the body on top of it rather than a rewrite
    // of what was already pasted into a project.
    assert.match(eventFixMigration, /array\['personalisedGreeting', 'motivationAnswered'\]/i);
    assert.ok(
      migrationFiles.indexOf(ONBOARDING_FIX) > migrationFiles.indexOf('202608250002_product_event_key_count_fix.sql'),
      'the onboarding fix does not come after the migration it corrects',
    );

    const onboardingFix = sqlOf(ONBOARDING_FIX);
    assert.doesNotMatch(stripComments(onboardingFix), /create trigger|drop trigger/i);
    assert.doesNotMatch(stripComments(onboardingFix), /drop table|alter table|delete from|truncate/i);
    assert.match(onboardingFix, /revoke all on function public\.validate_product_event\(\) from public, anon, authenticated/i);
  });

  test('the parser and the trigger require the same properties for every product event', () => {
    // The forcing function F116 was missing. Three layers validate a product event on
    // purpose — client union, parser, trigger — and only the client's is held to the
    // others by the compiler, so a property removed in TypeScript can leave two SQL and
    // server allowlists behind it with every suite still green.
    const body = effectiveBody(FUNCTION_HEADERS.validate_product_event);
    for (const event of PRODUCT_EVENTS) {
      const branch = triggerBranch(body, event);
      const keys = requiredKeys(branch, `the ${event} branch`);
      assert.deepEqual(
        keys,
        parserKeys(event),
        `${event} names different properties in parseProductEvent and in validate_product_event`,
      );
      assert.match(
        branch,
        new RegExp(`property_count <> ${keys.length}\\b`),
        `the ${event} branch counts a different number of properties than it names`,
      );
    }
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

    // F245's down-script restores a body that grants a free month to every cancelled
    // subscriber, forever, and it touches no rows — the same shape as the four interlocks
    // above, so it carries one too. F244's drops a table that holds rows instead.
    const reopensF245 = readFileSync(path.join(ROLLBACKS, '202608300002_down.sql'), 'utf8');
    assert.match(reopensF245, /REOPENS-F245/);
    assert.match(reopensF245, /parle\.reopen_f245/);
    assert.match(reopensF245, /raise exception\s*\n?\s*'refusing to restore the self-renewing paid period/i);
    const billingLedgerDown = readFileSync(path.join(ROLLBACKS, '202608300001_down.sql'), 'utf8');
    assert.match(billingLedgerDown, /DESTRUCTIVE/);
    assert.match(billingLedgerDown, /every billing event we have already acted on looks new again/i);
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
