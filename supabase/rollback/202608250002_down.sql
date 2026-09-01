-- Rollback for supabase/migrations/202608250002_product_event_key_count_fix.sql
--
-- REOPENS-F75. Read this before pasting.
--
-- 202608250002 changed exactly one object: the body of public.validate_product_event().
-- Rolling it back means restoring 202608230001's body, and that body calls
-- `jsonb_object_length`, a function PostgreSQL does not have. Every insert into
-- public.product_events then raises 42883 — from the client under RLS and from the
-- service role alike, because service role bypasses RLS and not triggers. The token
-- server turns that into a 500 and the mobile client swallows it by design, so the
-- symptom is not an error anybody sees: it is analytics that quietly reports nothing.
--
-- It fails closed, so no learner content can be written either. That makes this an
-- evidence-loss rollback rather than a privacy one, which is why the interlock wording
-- below says what it says.
--
-- There is almost never a reason to run this. 202608250002 adds no column, no table and
-- no row, and it does not touch the product_events_validate trigger — it swaps the
-- function body underneath it. If something looks broken after applying it, fix forward
-- with a new migration rather than restoring a call that cannot resolve.
--
-- The script refuses to run until the operator says so in the same paste:
--
--     set local luvani.reopen_f75 = 'yes-i-accept-losing-every-product-event';
--
-- Idempotent and retryable. It replaces one function body and touches no rows.

do $$
begin
  if coalesce(current_setting('luvani.reopen_f75', true), '') <> 'yes-i-accept-losing-every-product-event' then
    raise exception
      'refusing to restore the jsonb_object_length product-event trigger (F75): set luvani.reopen_f75 in this session first';
  end if;
end;
$$;

-- The 202608230001 definition, restored verbatim. The defect is the `jsonb_object_length`
-- initialiser, kept exactly as it was so that this file is a true rollback and not a
-- third variant of the function.
create or replace function public.validate_product_event()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  property_count integer := jsonb_object_length(new.properties);
begin
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
