-- Report 45. Device-local literal consent; three client facts and two service facts.
-- No new consent table, learner text, prices or allowance changes.
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

  if new.name in ('trial_started', 'minutes_refused') and current_user not in ('postgres', 'service_role') then
    raise exception 'server-only product event';
  end if;

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
  elsif new.name = 'restore_started' or new.name = 'restore_settled' then
    if not (new.properties ?& array['entry'])
      or new.properties->'entry' not in (to_jsonb('settings'::text), to_jsonb('wall'::text), to_jsonb('inline'::text)) then
      raise exception 'invalid restore event';
    end if;
    if new.name = 'restore_started' and property_count <> 1 then
      raise exception 'invalid restore_started event';
    end if;
    if new.name = 'restore_settled' and (property_count <> 2
      or not (new.properties ?& array['outcome'])
      or new.properties->'outcome' not in (to_jsonb('done'::text), to_jsonb('nothing-granted'::text), to_jsonb('cancelled'::text), to_jsonb('store-trouble'::text), to_jsonb('refresh-trouble'::text))) then
      raise exception 'invalid restore_settled event';
    end if;
  elsif new.name = 'wall_left' then
    if property_count <> 3 or not (new.properties ?& array['entry', 'outcome', 'destination'])
      or new.properties->'entry' not in (to_jsonb('path-complete'::text), to_jsonb('refused'::text), to_jsonb('settings'::text), to_jsonb('recap'::text))
      or new.properties->'outcome' not in (to_jsonb('granted'::text), to_jsonb('unchanged'::text))
      or new.properties->'destination' not in (to_jsonb('back'::text), to_jsonb('speak'::text)) then
      raise exception 'invalid wall_left event';
    end if;
  elsif new.name = 'trial_started' then
    if property_count <> 0 then raise exception 'invalid trial_started event'; end if;
  elsif new.name = 'minutes_refused' then
    if property_count <> 2 or not (new.properties ?& array['plan', 'reason'])
      or new.properties->'plan' not in (to_jsonb('trial'::text), to_jsonb('starter'::text), to_jsonb('regular'::text))
      or new.properties->'reason' not in (to_jsonb('exhausted'::text), to_jsonb('insufficient-for-session'::text)) then
      raise exception 'invalid minutes_refused event';
    end if;
  else
    raise exception 'unsupported product event';
  end if;

  return new;
end;
$$;

create or replace function public.claim_trial_with_evidence(
  p_user_id uuid,
  p_installation_hash text,
  p_user_hash text,
  p_analytics_allowed boolean
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
  -- Serialize this service's same-account starts; unique markers still guard installations.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text, 0));
  if p_installation_hash is null or p_installation_hash !~ '^[a-zA-Z0-9_-]{43}$'
    or p_user_hash is null or p_user_hash !~ '^[a-zA-Z0-9_-]{43}$' then
    raise exception 'invalid trial claim';
  end if;

  if exists (select 1 from public.entitlements where user_id = p_user_id) then
    return true;
  end if;

  insert into public.trial_installations (installation_hash, first_user_hash)
  values (p_installation_hash, p_user_hash)
  on conflict do nothing
  returning true into claimed;

  -- NULL-safe. A conflicting insert affects zero rows and leaves `claimed` NULL;
  -- `is not true` refuses on NULL exactly as it refuses on false. Never write this
  -- guard with a bare `not claimed`, which is the defect it exists to close.
  if claimed is not true then return false; end if;

  insert into public.entitlements (user_id, plan, seconds_used)
  values (p_user_id, 'trial', 0);
  if p_analytics_allowed is true then
    -- The savepoint encloses evidence alone. A broken sink never undoes the trial.
    begin
      insert into public.product_events(user_id, name, properties)
      values (p_user_id, 'trial_started', '{}'::jsonb);
    exception when others then null;
    end;
  end if;
  return true;
end;
$$;

revoke all on function public.claim_trial_with_evidence(uuid, text, text, boolean) from public, anon, authenticated;
grant execute on function public.claim_trial_with_evidence(uuid, text, text, boolean) to service_role;
