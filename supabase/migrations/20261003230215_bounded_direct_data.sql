-- Stage 1: protect direct Data API writes without replacing offline sync/CAS.
-- All 16 namespaces and legacy JSON shapes remain supported. Oversized legacy
-- rows remain readable; they must be reduced before their next successful write.
-- Limits are generous admission ceilings, not a claim of measured device/load
-- capacity. Calibrate against production traces before raising them.

create table if not exists luvani_private.data_write_quotas (
  user_id uuid primary key references auth.users(id) on delete cascade,
  minute_started_at timestamptz not null,
  day_started_at date not null,
  learner_minute integer not null default 0 check (learner_minute between 0 and 240),
  learner_day integer not null default 0 check (learner_day between 0 and 20000),
  events_minute integer not null default 0 check (events_minute between 0 and 60),
  events_day integer not null default 0 check (events_day between 0 and 1000)
);
alter table luvani_private.data_write_quotas enable row level security;
revoke all on luvani_private.data_write_quotas from public, anon, authenticated, service_role;

-- One bounded private row/account serializes quota admission. In READ COMMITTED
-- each volatile trigger's subsequent SELECT observes commits after a lock wait.
-- Auth parent first, then quota row; no entitlement/grant/pack/job locks are taken.
-- The statement guard below establishes parent-first before direct client UPDATE
-- acquires its learner child row. Service bulk UPDATE without auth.uid() must be
-- controlled/fenced by its caller; a row trigger is too late to reorder its locks.
create function luvani_private.admit_data_write_v1(p_user_id uuid, p_kind text)
returns void language plpgsql security definer set search_path = '' as $$
declare
  stamp timestamptz := date_trunc('minute', clock_timestamp());
  today date := (clock_timestamp() at time zone 'UTC')::date;
  q luvani_private.data_write_quotas;
begin
  if p_kind is null or p_kind not in ('learner', 'event') or p_user_id is null then
    raise exception using errcode='22023', message='invalid data admission';
  end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then raise exception using errcode='42501', message='account is not active'; end if;
  insert into luvani_private.data_write_quotas(user_id, minute_started_at, day_started_at)
    values(p_user_id, stamp, today) on conflict(user_id) do nothing;
  select * into strict q from luvani_private.data_write_quotas where user_id=p_user_id for update;
  -- Compute the bucket after waiting, so a request queued across a minute/day
  -- boundary cannot reset a newer committed bucket back to its admission time.
  stamp := date_trunc('minute', clock_timestamp());
  today := (clock_timestamp() at time zone 'UTC')::date;
  if q.minute_started_at is distinct from stamp then
    q.minute_started_at := stamp; q.learner_minute := 0; q.events_minute := 0;
  end if;
  if q.day_started_at is distinct from today then
    q.day_started_at := today; q.learner_day := 0; q.events_day := 0;
  end if;
  if p_kind='learner' then
    if q.learner_minute >= 240 or q.learner_day >= 20000 then
      raise exception using errcode='PT429', message='learner write quota reached';
    end if;
    q.learner_minute := q.learner_minute+1; q.learner_day := q.learner_day+1;
  else
    if q.events_minute >= 60 or q.events_day >= 1000 then
      raise exception using errcode='PT429', message='product event quota reached';
    end if;
    q.events_minute := q.events_minute+1; q.events_day := q.events_day+1;
  end if;
  update luvani_private.data_write_quotas set minute_started_at=q.minute_started_at,
    day_started_at=q.day_started_at, learner_minute=q.learner_minute,
    learner_day=q.learner_day, events_minute=q.events_minute, events_day=q.events_day
    where user_id=p_user_id;
end; $$;
revoke all on function luvani_private.admit_data_write_v1(uuid,text) from public,anon,authenticated,service_role;

-- PostgreSQL runs BEFORE STATEMENT before locking the DML's target child rows.
-- Authenticated direct Data API writers have exactly one RLS owner, auth.uid().
-- Take that parent lock here rather than too late in a learner BEFORE ROW trigger.
-- Trusted service bulk updates and FK cascades have no client identity; their
-- callers retain responsibility for account fencing/retry. Account deletion's
-- cascade must not be mistaken for a fresh authenticated client operation.
create function luvani_private.lock_client_data_owner_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true) in ('anon','authenticated') then
    if auth.uid() is null then raise exception using errcode='42501', message='account is not active'; end if;
    perform 1 from auth.users where id=auth.uid() for key share;
    if not found then raise exception using errcode='42501', message='account is not active'; end if;
  end if;
  return null;
end; $$;
revoke all on function luvani_private.lock_client_data_owner_v1() from public,anon,authenticated,service_role;
create trigger learner_state_owner_statement before insert or update or delete on public.learner_state
  for each statement execute function luvani_private.lock_client_data_owner_v1();
create trigger product_events_owner_statement before insert or update on public.product_events
  for each statement execute function luvani_private.lock_client_data_owner_v1();

-- JSONB prints one structural space after ':' and ','. Count those structurally
-- (never strip string contents) to enforce a 512 KiB compact-equivalent UTF-8
-- bound compatible with the mobile envelope cap. PostgreSQL number rendering
-- is authoritative; unusually large exponential numbers can be rejected earlier.
-- Depth/node/container bounds limit aggregate JSON expansion in Friends stats.
create function luvani_private.check_learner_payload_v1(p_payload jsonb)
returns void language plpgsql set search_path = '' as $$
declare
  nodes integer; deepest integer; largest_array integer; largest_object integer;
  structural_spaces bigint; bytes integer;
begin
  if p_payload is null or jsonb_typeof(p_payload) not in ('object','array') then
    raise exception using errcode='23514', message='invalid learner payload';
  end if;
  -- Fast rejection before traversal; within the node bound structural whitespace
  -- adds less than this 256 KiB margin to a legitimate compact 512 KiB envelope.
  bytes := octet_length(p_payload::text);
  if bytes > 786432 then
    raise exception using errcode='23514', message='learner payload byte limit exceeded';
  end if;
  with recursive walk(value, depth) as (
    select p_payload, 0
    union all
    select child.value, walk.depth+1 from walk cross join lateral (
      select e.value from jsonb_each(case when jsonb_typeof(walk.value)='object' then walk.value else '{}'::jsonb end) e
      union all
      select a.value from jsonb_array_elements(case when jsonb_typeof(walk.value)='array' then walk.value else '[]'::jsonb end) a
    ) child where walk.depth < 25
  ), bounded as (select * from walk limit 100001), sizes as (
    select depth,
      case when jsonb_typeof(value)='array' then jsonb_array_length(value) else 0 end as arrays,
      case when jsonb_typeof(value)='object' then (select count(*)::integer from jsonb_object_keys(value)) else 0 end as objects
    from bounded
  ) select count(*)::integer, max(depth), max(arrays), max(objects),
    coalesce(sum(greatest(arrays-1,0)+greatest(2*objects-1,0)),0)
    into nodes, deepest, largest_array, largest_object, structural_spaces from sizes;
  if nodes > 100000 or deepest > 24 or largest_array > 20000 or largest_object > 5000 then
    raise exception using errcode='23514', message='learner payload item or depth limit exceeded';
  end if;
  if bytes-structural_spaces > 524288 then
    raise exception using errcode='23514', message='learner payload byte limit exceeded';
  end if;
end; $$;
revoke all on function luvani_private.check_learner_payload_v1(jsonb) from public,anon,authenticated,service_role;

create function luvani_private.bound_learner_write_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then
    raise exception using errcode='42501', message='learner state owner is invalid';
  end if;
  if tg_op='UPDATE' and (new.user_id is distinct from old.user_id or new.namespace is distinct from old.namespace) then
    raise exception using errcode='23514', message='learner state identity is immutable';
  end if;
  perform luvani_private.check_learner_payload_v1(new.payload);
  perform luvani_private.admit_data_write_v1(new.user_id,'learner');
  if tg_op='INSERT' then new.updated_at := clock_timestamp(); new.revision := 0; end if;
  return new;
end; $$;
revoke all on function luvani_private.bound_learner_write_v1() from public,anon,authenticated,service_role;
create trigger learner_state_admission before insert or update on public.learner_state
  for each row execute function luvani_private.bound_learner_write_v1();

-- The namespace whitelist plus (user_id,namespace) PK gives <=16 rows and <=8 MiB
-- compact JSON/account after all rows satisfy admission. Future namespace additions
-- must review that account budget. Failed writes/transactions roll back quota use.

alter table public.product_events add column if not exists received_at timestamptz;
-- Legacy receipt provenance is unavailable. Clamp claimed event time to migration
-- time so a future forged timestamp cannot postpone retention indefinitely. This
-- backfill is explicitly not evidence of the historical server receipt time.
update public.product_events set received_at=least(occurred_at, clock_timestamp()) where received_at is null;
alter table public.product_events alter column received_at set not null;
alter table public.product_events alter column received_at set default clock_timestamp();
create index product_events_received_at_idx on public.product_events(received_at,id);

create function luvani_private.bound_product_event_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
declare retained integer;
begin
  if current_setting('role',true) in ('anon','authenticated') and auth.uid() is distinct from new.user_id then
    raise exception using errcode='42501', message='product event owner is invalid';
  end if;
  if tg_op='UPDATE' then
    if new.user_id is distinct from old.user_id or new.received_at is distinct from old.received_at then
      raise exception using errcode='23514', message='product event receipt identity is immutable';
    end if;
    return new;
  end if;
  new.received_at := clock_timestamp();
  perform luvani_private.admit_data_write_v1(new.user_id,'event');
  -- Bound the probe even when legacy data already exceeds the admission ceiling.
  -- Serialize with all inserts by this owner before examining retained rows.
  select count(*)::integer into retained from
    (select 1 from public.product_events where user_id=new.user_id limit 10000) bounded;
  if retained >= 10000 then
    raise exception using errcode='PT429', message='retained product event quota reached';
  end if;
  return new;
end; $$;
revoke all on function luvani_private.bound_product_event_v1() from public,anon,authenticated,service_role;
create trigger product_events_admission before insert or update on public.product_events
  for each row execute function luvani_private.bound_product_event_v1();
