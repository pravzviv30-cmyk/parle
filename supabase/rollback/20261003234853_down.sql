begin;
do $$ begin
  if pg_catalog.current_setting('luvani.rollback_privacy_maintenance',true) is distinct from 'on' then raise exception 'privacy maintenance rollback requires drained writers and explicit interlock'; end if;
  if exists(select 1 from public.account_erasure_jobs) then raise exception 'erasure evidence exists; use forward repair'; end if;
  if exists(select 1 from public.privacy_processor_history where ever_enabled) then raise exception 'processor history exists; use forward repair'; end if;
end $$;

alter policy "learners read their own state" on public.learner_state using(auth.uid()=user_id);
alter policy "learners insert their own state" on public.learner_state with check(auth.uid()=user_id);
alter policy "learners update their own state" on public.learner_state using(auth.uid()=user_id) with check(auth.uid()=user_id);
alter policy "learners delete their own state" on public.learner_state using(auth.uid()=user_id);
alter policy "learners append their own events" on public.product_events with check(auth.uid()=user_id);
alter policy "learners read their own entitlement" on public.entitlements using(auth.uid()=user_id);
alter policy "learners read their own conversation packs" on public.conversation_packs using(auth.uid()=user_id);
create or replace function public.luvani_social(action text,args jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select luvani_private.social_dispatch(action,args)$$;
grant execute on function luvani_private.social_dispatch(text,jsonb) to authenticated;
drop function if exists public.own_account_active_v1();
create or replace function luvani_private.admit_data_write_v1(p_user_id uuid, p_kind text)
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
create or replace function luvani_private.lock_client_data_owner_v1()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if current_setting('role',true) in ('anon','authenticated') then
    if auth.uid() is null then raise exception using errcode='42501', message='account is not active'; end if;
    perform 1 from auth.users where id=auth.uid() for key share;
    if not found then raise exception using errcode='42501', message='account is not active'; end if;
  end if;
  return null;
end; $$;
drop function if exists public.backend_catalog_v1();
drop function if exists public.backend_status_v1();
drop function if exists public.publish_backend_heartbeat_v1(text,uuid,boolean);
drop index if exists public.account_erasure_oldest_pending;
drop index if exists public.backend_worker_heartbeat_expiry;
drop table if exists public.backend_worker_heartbeats;
drop function if exists public.advance_account_erasure_v1(uuid,uuid,text);
drop function if exists public.claim_account_erasure_v1();
drop function if exists public.begin_account_erasure_v1(uuid,boolean);
drop function if exists public.configure_privacy_processor_v1(boolean);
drop index if exists public.account_erasure_due;
drop table if exists public.account_erasure_jobs;
drop table if exists public.privacy_processor_history;
commit;
