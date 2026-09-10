-- The subscription wall's five product events.
--
-- Adds `wall_shown`, `wall_page_seen`, `plan_selected`, `purchase_started` and
-- `purchase_settled` to the trigger's allowlist. Until this is applied those five
-- raise `unsupported product event` and the token server's write fails, which the
-- client swallows by design, so the wall's funnel would be dark without anybody
-- seeing an error. That is exactly how F116 survived a release, and it is why the
-- three layers are changed together: this trigger, `parseProductEvent`, and the
-- `ProductEvent` union in apps/mobile/src/analytics/track.ts.
--
-- What these events may carry is deliberately narrow. `plan` is our own tier id and
-- never a price; `entry`, `page` and `outcome` are closed sets; `pages` and `index`
-- are small integers. No phrase, no situation, no learner content, and no free text
-- anywhere. `pages` rides with `wall_shown` because the page list is computed per
-- showing, so a drop-off at index 2 says nothing without knowing how many there were.
--
-- Idempotent. It replaces one function body, leaves the product_events_validate
-- trigger in place exactly as 202608270001 did, so there is no instant in which
-- product_events has no validation, and it writes no rows.

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
  elsif new.name = 'wall_shown' then
    if property_count <> 2
      or not (new.properties ?& array['entry', 'pages'])
      or new.properties->'entry' not in (
        to_jsonb('path-complete'::text),
        to_jsonb('refused'::text),
        to_jsonb('settings'::text),
        to_jsonb('recap'::text)
      )
      or jsonb_typeof(new.properties->'pages') <> 'number'
      or (new.properties->>'pages')::numeric not between 0 and 100000
      or mod((new.properties->>'pages')::numeric, 1) <> 0 then
      raise exception 'invalid wall_shown event';
    end if;
  elsif new.name = 'wall_page_seen' then
    if property_count <> 2
      or not (new.properties ?& array['page', 'index'])
      or new.properties->'page' not in (
        to_jsonb('map'::text),
        to_jsonb('french'::text),
        to_jsonb('yours'::text),
        to_jsonb('plans'::text)
      )
      or jsonb_typeof(new.properties->'index') <> 'number'
      or (new.properties->>'index')::numeric not between 0 and 100000
      or mod((new.properties->>'index')::numeric, 1) <> 0 then
      raise exception 'invalid wall_page_seen event';
    end if;
  elsif new.name = 'plan_selected' then
    if property_count <> 1
      or not (new.properties ?& array['plan'])
      or new.properties->'plan' not in (to_jsonb('starter'::text), to_jsonb('regular'::text)) then
      raise exception 'invalid plan_selected event';
    end if;
  elsif new.name = 'purchase_started' then
    if property_count <> 1
      or not (new.properties ?& array['plan'])
      or new.properties->'plan' not in (to_jsonb('starter'::text), to_jsonb('regular'::text)) then
      raise exception 'invalid purchase_started event';
    end if;
  elsif new.name = 'purchase_settled' then
    if property_count <> 2
      or not (new.properties ?& array['plan', 'outcome'])
      or new.properties->'plan' not in (to_jsonb('starter'::text), to_jsonb('regular'::text))
      or new.properties->'outcome' not in (
        to_jsonb('done'::text),
        to_jsonb('nothing-granted'::text),
        to_jsonb('cancelled'::text),
        to_jsonb('store-trouble'::text),
        to_jsonb('refresh-trouble'::text)
      ) then
      raise exception 'invalid purchase_settled event';
    end if;
  else
    raise exception 'unsupported product event';
  end if;

  return new;
end;
$$;
