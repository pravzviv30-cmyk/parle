-- F75 — the product-event validation trigger called a function Postgres does not have.
--
-- 202608230001 declared the trigger's only counter as (its line 152):
--
--     declare property_count integer := jsonb_object_length(new.properties);
--
-- There is no `jsonb_object_length` in any version of PostgreSQL. `jsonb_array_length`
-- and `jsonb_object_keys` exist; that name does not. plpgsql binds function calls late,
-- so `create or replace function` accepted the body and the migration applied clean —
-- the 42883 only appears on the first row that reaches the trigger. The DECLARE block
-- runs at block entry, before any branch, so the failure is unconditional: it does not
-- depend on the event name, on the properties, or on the role. Service role bypasses
-- RLS but not triggers, so both the client path and the server path failed.
--
-- Measured live before this fix: a valid `mission_started` insert, an unsupported
-- `transcript_captured` insert and an empty-properties insert all returned
-- `42883 function jsonb_object_length(jsonb) does not exist`. Every product event
-- written against this schema, from any caller, has been silently lost since
-- 202608230001, because services/token-server/src/server.ts turns the write failure
-- into a 500 and apps/mobile/src/analytics/track.ts swallows it by design.
--
-- It fails closed, which is why this is evidence loss and not a privacy hole: a
-- modified client could not write a transcript either. The content-free boundary the
-- trigger exists to enforce was never actually enforced, though, so it has to work.
--
-- The count is now taken with `jsonb_object_keys`, which does exist, and the shape
-- guard comes first for two reasons. `jsonb_object_keys` raises 22023 on an array or a
-- scalar, and the table's own `check (jsonb_typeof(properties) = 'object')` from
-- 202608220001 runs *after* this BEFORE ROW trigger, so the trigger is the first thing
-- a non-object meets. The guard is written NULL-first rather than relying on
-- `jsonb_typeof(null) <> 'object'`, which is NULL and would take neither branch — the
-- same three-valued trap as F73 and F74.
--
-- Both `jsonb_object_keys` and `jsonb_typeof` resolve under `set search_path = ''`:
-- pg_catalog is always implicitly searched. They are qualified anyway, so the file
-- reads the same as it resolves.
--
-- Forward-only, and deliberately only the function. `create or replace function` swaps
-- the body underneath the live `product_events_validate` trigger with no window in
-- which the table has no validation; re-issuing `drop trigger` / `create trigger` would
-- open exactly that window. Every branch below is 202608230001's verbatim. Idempotent,
-- bounded to one catalogue entry, retryable, and it reads and writes no rows.
--
-- Rolling this back restores the broken call. See supabase/rollback/202608250002_down.sql.

create or replace function public.validate_product_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  property_count integer;
begin
  if new.properties is null or pg_catalog.jsonb_typeof(new.properties) <> 'object' then
    raise exception 'unsupported product event';
  end if;

  select count(*) into property_count
  from pg_catalog.jsonb_object_keys(new.properties);

  if new.name = 'onboarding_completed' then
    if property_count <> 2
      or not (new.properties ?& array['personalisedGreeting', 'motivationAnswered'])
      or jsonb_typeof(new.properties->'personalisedGreeting') <> 'boolean'
      or jsonb_typeof(new.properties->'motivationAnswered') <> 'boolean' then
      raise exception 'invalid onboarding_completed event';
    end if;
  elsif new.name = 'mission_started' then
    if property_count <> 2
      or not (new.properties ?& array['missionId', 'entry'])
      or jsonb_typeof(new.properties->'missionId') <> 'string'
      or not ((new.properties->>'missionId') ~ '^[a-zA-Z0-9:._-]{1,64}$')
      or new.properties->'entry' not in (to_jsonb('chooser'::text), to_jsonb('home'::text), to_jsonb('my-french'::text)) then
      raise exception 'invalid mission_started event';
    end if;
  elsif new.name = 'mission_completed' then
    if property_count <> 2
      or not (new.properties ?& array['missionId', 'rung'])
      or jsonb_typeof(new.properties->'missionId') <> 'string'
      or not ((new.properties->>'missionId') ~ '^[a-zA-Z0-9:._-]{1,64}$')
      or new.properties->'rung' not in ('1'::jsonb, '2'::jsonb, '3'::jsonb, '4'::jsonb) then
      raise exception 'invalid mission_completed event';
    end if;
  elsif new.name = 'sound_check_completed' then
    if property_count <> 2
      or not (new.properties ?& array['missionId', 'kind'])
      or jsonb_typeof(new.properties->'missionId') <> 'string'
      or not ((new.properties->>'missionId') ~ '^[a-zA-Z0-9:._-]{1,64}$')
      or new.properties->'kind' not in (
        to_jsonb('assessed-clear'::text),
        to_jsonb('assessed-focus'::text),
        to_jsonb('self-guided'::text),
        to_jsonb('unavailable'::text)
      ) then
      raise exception 'invalid sound_check_completed event';
    end if;
  elsif new.name = 'my_french_opened' then
    if property_count <> 2
      or not (new.properties ?& array['situationsDone', 'linesKept'])
      or jsonb_typeof(new.properties->'situationsDone') <> 'number'
      or jsonb_typeof(new.properties->'linesKept') <> 'number'
      or (new.properties->>'situationsDone')::numeric not between 0 and 100000
      or (new.properties->>'linesKept')::numeric not between 0 and 100000
      or mod((new.properties->>'situationsDone')::numeric, 1) <> 0
      or mod((new.properties->>'linesKept')::numeric, 1) <> 0 then
      raise exception 'invalid my_french_opened event';
    end if;
  else
    raise exception 'unsupported product event';
  end if;

  return new;
end;
$$;

revoke all on function public.validate_product_event() from public, anon, authenticated;
