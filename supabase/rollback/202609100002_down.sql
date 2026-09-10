-- Rollback for supabase/migrations/202609100002_wall_product_events.sql
--
-- LOSES EVERY SUBSCRIPTION WALL EVENT. Read this before pasting.
--
-- 202609100002 changed exactly one object: the body of public.validate_product_event().
-- It created no table, no column, no index, no policy and no trigger, and it wrote no
-- rows. So there is nothing here to drop, and rolling back means restoring 202608270001's
-- body, the one whose allowlist stops at `my_french_opened`.
--
-- What that costs: `wall_shown`, `wall_page_seen`, `plan_selected`, `purchase_started`
-- and `purchase_settled` all start raising `unsupported product event`. The token server
-- turns the write failure into a 500 and apps/mobile/src/analytics/track.ts swallows it by
-- design, so nobody sees an error. The wall's funnel simply goes dark, silently, and the
-- one question a paywall exists to answer -- which page lost them -- stops having an
-- answer. That is the same failure shape as F116, which is why this refuses to run rather
-- than merely warning.
--
-- It fails closed and it is not a privacy hole: no learner content can be written by this
-- path either way, and the other five events are unaffected. This is evidence loss.
--
-- There is almost never a reason to run this. If a wall event looks wrong after applying
-- 202609100002, fix forward with a new migration rather than restoring a trigger that
-- disagrees with the client on purpose.
--
-- The script refuses to run until the operator says so in the same paste:
--
--     set local luvani.blind_the_wall = 'yes-i-accept-losing-every-wall-event';
--
-- Idempotent and retryable. It replaces one function body and touches no rows. It leaves
-- the product_events_validate trigger alone, exactly as the migration did, so there is no
-- instant in which product_events has no validation.

do $$
begin
  if coalesce(current_setting('luvani.blind_the_wall', true), '') <> 'yes-i-accept-losing-every-wall-event' then
    raise exception
      'refusing to narrow the product-event allowlist back below the subscription wall: set luvani.blind_the_wall in this session first';
  end if;
end;
$$;

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
