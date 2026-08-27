-- Rollback for supabase/migrations/202608270001_onboarding_event_property_fix.sql
--
-- REOPENS-F116. Read this before pasting.
--
-- 202608270001 changed exactly one object: the body of public.validate_product_event().
-- It created no table, no column, no index, no policy and no trigger, and it wrote no
-- rows. So there is nothing here to drop, and rolling back means restoring 202608250002's
-- body — the one that demands both `personalisedGreeting` and `motivationAnswered` on
-- `onboarding_completed`.
--
-- What that costs: the shipped client sends `{ personalisedGreeting }` alone, so every
-- `onboarding_completed` starts raising `invalid onboarding_completed event` again. The
-- token server turns the write failure into a 500 and apps/mobile/src/analytics/track.ts
-- swallows it by design, so nobody sees an error — the onboarding funnel just goes dark
-- again, which is how F116 survived a release in the first place.
--
-- It fails closed. No learner content can be written by this path either, and the other
-- four events are unaffected, so this is evidence loss and not a privacy hole. That is
-- what the interlock wording below is about.
--
-- There is almost never a reason to run this. If something looks wrong with the trigger
-- after applying 202608270001, fix forward with a new migration rather than restoring a
-- guard that disagrees with the client on purpose.
--
-- The script refuses to run until the operator says so in the same paste:
--
--     set local parle.reopen_f116 = 'yes-i-accept-losing-every-onboarding-event';
--
-- Idempotent and retryable. It replaces one function body and touches no rows. It leaves
-- the product_events_validate trigger alone, exactly as the migration did, so there is no
-- instant in which product_events has no validation.

do $$
begin
  if coalesce(current_setting('parle.reopen_f116', true), '') <> 'yes-i-accept-losing-every-onboarding-event' then
    raise exception
      'refusing to restore the two-key onboarding_completed product-event guard (F116): set parle.reopen_f116 in this session first';
  end if;
end;
$$;

-- The 202608250002 definition, restored verbatim. The defect is the `onboarding_completed`
-- branch demanding a property the client no longer sends, kept exactly as it was so that
-- this file is a true rollback and not a third variant of the function.
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
