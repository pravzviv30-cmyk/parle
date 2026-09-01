-- F116 — the trigger still demands a property the client stopped sending.
--
-- Luvani validates a product event three times on purpose: the client's typed union in
-- apps/mobile/src/analytics/track.ts, parseProductEvent in the token server, and this
-- trigger. The third layer is not belt and braces. RLS lets a signed-in learner insert
-- into public.product_events directly over PostgREST, so a modified client can skip the
-- token server entirely and the database has to repeat the check itself.
--
-- Phase 3 deleted onboarding's "why are you learning French" page, so the client union
-- dropped `motivationAnswered` and now sends `{ personalisedGreeting }` alone. A property
-- that can only ever be false is noise dressed as evidence. Typecheck forced the client's
-- half of that decision and nothing forced the other two, so the parser and this trigger
-- were both left demanding the old exact key set:
--
--     if property_count <> 2
--       or not (new.properties ?& array['personalisedGreeting', 'motivationAnswered'])
--
-- Both arms of that guard fail on the shape the client now sends. Every
-- `onboarding_completed` written since Phase 3 raised `invalid onboarding_completed
-- event`, the token server turned it into a 500 and apps/mobile/src/analytics/track.ts
-- swallows it by design, so the onboarding funnel simply stopped arriving. Nothing was
-- corrupted and no learner noticed; the loss is evidence, and it is silent, which is the
-- expensive kind.
--
-- This file changes exactly one branch. `onboarding_completed` now requires one property,
-- named `personalisedGreeting`, holding a boolean. The count check is what makes it exact
-- rather than a subset test: `?&` alone would accept `{ personalisedGreeting, transcript }`,
-- and the whole point of the trigger is that a client cannot smuggle content into an
-- allowlisted event. `property_count <> 1` and the one-key `?&` together mean the object
-- has that key and nothing else. The retired `motivationAnswered` is now refused rather
-- than ignored, which is deliberate: a client still sending it is a stale build, and a
-- trimmed-and-accepted write would hide that.
--
-- The other four branches are 202608250002's verbatim, including the count taken with
-- `jsonb_object_keys` (F75: `jsonb_object_length` does not exist in any version of
-- PostgreSQL, plpgsql binds late, so that misspelling applied clean and then failed every
-- insert at run time) and the NULL-first shape guard that has to run before the count,
-- because `jsonb_object_keys` raises 22023 on an array or a scalar and the table's own
-- `check (jsonb_typeof(properties) = 'object')` runs after this BEFORE ROW trigger.
--
-- Both `jsonb_object_keys` and `jsonb_typeof` resolve under `set search_path = ''` —
-- pg_catalog is always implicitly searched. They are qualified anyway, so the file reads
-- the same way it resolves.
--
-- 202608250002 is not rewritten. Migrations here are forward-only, and the record of what
-- was deployed on 2026-08-25 is worth more than a tidy directory.
--
-- Forward-compatible, and worth stating in which direction. A client that has not shipped
-- yet keeps sending both keys and is refused, exactly as it is refused today, so applying
-- this early breaks nothing that is not already broken. A client that has shipped starts
-- being accepted the moment this lands. There is no ordering hazard between the app
-- release and this paste.
--
-- Bounded to one catalogue entry, idempotent, retryable, reads and writes no rows.
-- `create or replace function` swaps the body underneath the live
-- `product_events_validate` trigger with no window in which product_events has no
-- validation; `drop trigger` / `create trigger` would open exactly that window.
--
-- Rollback: supabase/rollback/202608270001_down.sql, which reopens F116.

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
    -- One property, and `?&` on a single-element array rather than a bare `?` so this
    -- branch reads like the four below and so no tool that treats `?` as a bind
    -- placeholder can mangle it on the way to the SQL editor.
    if property_count <> 1
      or not (new.properties ?& array['personalisedGreeting'])
      or jsonb_typeof(new.properties->'personalisedGreeting') <> 'boolean' then
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
