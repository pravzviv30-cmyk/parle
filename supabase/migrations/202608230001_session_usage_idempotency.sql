-- Every voice session is billed at most once, even when the agent retries its
-- end report after a timeout. Raw audio and transcripts never enter this table.

create table if not exists public.session_usage (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  seconds integer not null check (seconds >= 0 and seconds <= 900),
  reported_at timestamptz not null default now()
);

create index if not exists session_usage_user_time_idx
on public.session_usage (user_id, reported_at desc);

alter table public.session_usage enable row level security;

-- There are deliberately no client policies. Only the service-role RPC can
-- insert or inspect billing reports.

drop function if exists public.consume_entitlement(uuid, integer);

-- Pseudonymous antifraud evidence intentionally survives account deletion.
-- It contains no platform advertising id, email, Supabase uid or raw install
-- id: both values are deployment-salted HMACs made by the token server.
create table if not exists public.trial_installations (
  installation_hash text primary key check (installation_hash ~ '^[a-zA-Z0-9_-]{43}$'),
  first_user_hash text not null unique check (first_user_hash ~ '^[a-zA-Z0-9_-]{43}$'),
  claimed_at timestamptz not null default now()
);

alter table public.trial_installations enable row level security;
revoke all on table public.trial_installations from public, anon, authenticated;

create or replace function public.claim_trial(
  p_user_id uuid,
  p_installation_hash text,
  p_user_hash text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  claimed boolean := false;
begin
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

  if not claimed then return false; end if;

  insert into public.entitlements (user_id, plan, seconds_used)
  values (p_user_id, 'trial', 0);
  return true;
end;
$$;

revoke all on function public.claim_trial(uuid, text, text) from public, anon, authenticated;
grant execute on function public.claim_trial(uuid, text, text) to service_role;

create or replace function public.consume_entitlement(
  p_user_id uuid,
  p_seconds integer,
  p_session_id uuid
)
returns public.entitlements
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.entitlements;
  recorded boolean := false;
  recorded_user uuid;
begin
  if p_seconds is null or p_seconds < 0 or p_seconds > 900 then
    raise exception 'seconds must be between 0 and 900';
  end if;

  select * into result
  from public.entitlements
  where user_id = p_user_id;
  if not found then raise exception 'entitlement has not been provisioned'; end if;

  if p_session_id is not null then
    insert into public.session_usage (session_id, user_id, seconds)
    values (p_session_id, p_user_id, p_seconds)
    on conflict (session_id) do nothing
    returning true into recorded;

    if not recorded then
      select user_id into recorded_user
      from public.session_usage
      where session_id = p_session_id;

      if recorded_user is distinct from p_user_id then
        raise exception 'session id already belongs to another account';
      end if;

      select * into result
      from public.entitlements
      where user_id = p_user_id;
      return result;
    end if;
  end if;

  update public.entitlements
  set
    seconds_used = least(
      case plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 27000 else 0 end,
      case
        when period_end is not null and period_end <= now() then p_seconds
        else seconds_used + p_seconds
      end
    ),
    period_end = case
      when plan = 'trial' then null
      when period_end is null or period_end <= now() then now() + interval '30 days'
      else period_end
    end,
    updated_at = now()
  where user_id = p_user_id
  returning * into result;

  return result;
end;
$$;

revoke all on table public.session_usage from public, anon, authenticated;
revoke all on function public.consume_entitlement(uuid, integer, uuid) from public, anon, authenticated;
grant execute on function public.consume_entitlement(uuid, integer, uuid) to service_role;

-- The mobile client can insert events under RLS, so the database must enforce
-- the same content-free schemas as the API parser. Otherwise a modified client
-- could write transcripts or identity fields straight through PostgREST.
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
drop trigger if exists product_events_validate on public.product_events;
create trigger product_events_validate
before insert or update on public.product_events
for each row execute function public.validate_product_event();
