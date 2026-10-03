-- Deploy only after draining old token-server/worker writers. An already-running
-- pre-migration function body keeps its old lock order until its transaction ends.
alter table public.entitlements add column usage_epoch uuid not null default gen_random_uuid();
alter table public.session_usage add column charged_seconds integer check(charged_seconds between 0 and 900);
alter table public.session_usage add column usage_epoch uuid;
alter table public.session_usage add column refund_reason text check(refund_reason in ('stt_error','tts_error','llm_error','realtime_model_error','interruption_detection_error'));
alter table public.session_usage add column refunded_at timestamptz;
alter table public.session_usage add column refunded_seconds integer check(refunded_seconds between 0 and 900);
-- Old rows deliberately keep NULL proof. Requested seconds are not actual charge.
create table public.session_grants (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  usage_epoch uuid not null,
  created_at timestamptz not null default now()
);
create index session_grants_owner on public.session_grants(user_id);
alter table public.session_grants enable row level security;
revoke all on public.session_grants from public,anon,authenticated;
grant select on public.session_grants to service_role;

create function public.advance_usage_epoch() returns trigger language plpgsql set search_path = '' as $$
begin
  if new.period_end is distinct from old.period_end
    or (new.plan='trial') is distinct from (old.plan='trial')
    or new.lapsed_from_paid is distinct from old.lapsed_from_paid then
    new.usage_epoch := gen_random_uuid();
  else new.usage_epoch := old.usage_epoch;
  end if;
  return new;
end; $$;
revoke all on function public.advance_usage_epoch() from public,anon,authenticated;
create trigger entitlement_usage_epoch before update on public.entitlements for each row execute function public.advance_usage_epoch();

create function public.record_session_grant(p_user_id uuid,p_session_id uuid,p_plan text,p_seconds_used integer,p_period_end timestamptz)
returns boolean language plpgsql security definer set search_path = '' as $$
declare e public.entitlements; g public.session_grants;
begin
  if p_session_id is null then raise exception 'session id required'; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then raise exception 'entitlement has not been provisioned'; end if;
  if e.plan is distinct from p_plan or e.seconds_used is distinct from p_seconds_used
    or e.period_end is distinct from p_period_end then return false; end if;
  insert into public.session_grants(session_id,user_id,usage_epoch) values(p_session_id,p_user_id,e.usage_epoch)
    on conflict(session_id) do nothing;
  select * into g from public.session_grants where session_id=p_session_id;
  if g.user_id is distinct from p_user_id then raise exception 'session id already belongs to another account'; end if;
  return g.usage_epoch=e.usage_epoch;
end; $$;

-- Every non-null session consume is grant-aware, including direct/old RPC calls.
create or replace function public.consume_entitlement(p_user_id uuid,p_seconds integer,p_session_id uuid)
returns public.entitlements language plpgsql security definer set search_path = '' as $$
declare e public.entitlements; prior public.entitlements; g public.session_grants; u public.session_usage; delta integer := 0;
begin
  if p_seconds is null or p_seconds < 0 or p_seconds > 900 then raise exception 'seconds must be between 0 and 900'; end if;
  if p_session_id is null and p_seconds <> 0 then raise exception 'unbound debits are refused'; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then raise exception 'entitlement has not been provisioned'; end if;
  if p_session_id is not null then
    select * into u from public.session_usage where session_id=p_session_id for update;
    if found then
      if u.user_id is distinct from p_user_id then raise exception 'session id already belongs to another account'; end if;
      return e;
    end if;
    select * into g from public.session_grants where session_id=p_session_id;
    if not found or g.user_id is distinct from p_user_id then raise exception 'session grant owner is missing or invalid'; end if;
  end if;
  prior := e;
  if e.plan <> 'trial' and e.period_end is not null and e.period_end < now()-interval '24 hours' then
    update public.entitlements set plan='trial',seconds_used=1800,period_end=null,lapsed_from_paid=true,updated_at=now()
      where user_id=p_user_id returning * into e;
  elsif p_session_id is not null and g.usage_epoch=e.usage_epoch then
    update public.entitlements set seconds_used=least(
      case plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 18000 else 0 end,
      seconds_used+p_seconds),updated_at=now() where user_id=p_user_id returning * into e;
    delta := greatest(0,e.seconds_used-prior.seconds_used);
  end if;
  if p_session_id is not null then
    insert into public.session_usage(session_id,user_id,seconds,charged_seconds,usage_epoch)
      values(p_session_id,p_user_id,p_seconds,delta,g.usage_epoch);
  end if;
  return e;
end; $$;

create function public.refund_failed_session(p_user_id uuid,p_session_id uuid,p_failure text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare e public.entitlements; g public.session_grants; u public.session_usage; kind text; cap integer;
begin
  if p_session_id is null or p_failure is null or p_failure not in ('stt_error','tts_error','llm_error','realtime_model_error','interruption_detection_error') then
    raise exception 'recognized service failure and session required'; end if;
  select * into e from public.entitlements where user_id=p_user_id for update;
  if not found then raise exception 'entitlement has not been provisioned'; end if;
  select * into g from public.session_grants where session_id=p_session_id;
  if not found then raise exception using errcode='PT409',message='session grant proof requires reconciliation'; end if;
  if g.user_id is distinct from p_user_id then raise exception 'session grant owner is invalid'; end if;
  select * into u from public.session_usage where session_id=p_session_id for update;
  if found then
    if u.user_id is distinct from p_user_id then raise exception 'session id already belongs to another account'; end if;
    if u.charged_seconds is null or u.usage_epoch is null then raise exception using errcode='PT409',message='legacy charge requires reconciliation'; end if;
  else
    insert into public.session_usage(session_id,user_id,seconds,charged_seconds,usage_epoch)
      values(p_session_id,p_user_id,0,0,g.usage_epoch) returning * into u;
  end if;
  -- Match ordinary settlement's lazy paid lapse under the same row lock.
  -- The trigger advances the epoch before any current-period credit decision.
  if e.plan<>'trial' and e.period_end is not null and e.period_end<now()-interval '24 hours' then
    update public.entitlements set plan='trial',seconds_used=1800,period_end=null,lapsed_from_paid=true,updated_at=now()
      where user_id=p_user_id returning * into e;
  end if;
  if u.refunded_at is null then
    if u.usage_epoch=e.usage_epoch then
      update public.entitlements set seconds_used=greatest(0,seconds_used-u.charged_seconds),updated_at=now()
        where user_id=p_user_id returning * into e;
    end if;
    update public.session_usage set refund_reason=p_failure,refunded_at=now(),refunded_seconds=u.charged_seconds
      where session_id=p_session_id returning * into u;
  end if;
  kind := case when u.charged_seconds=0 then 'not-charged' when u.usage_epoch=e.usage_epoch then 'restored-current-period' else 'historical-reversal' end;
  cap := case e.plan when 'trial' then 1800 when 'starter' then 10800 when 'regular' then 18000 else 0 end;
  return jsonb_build_object('kind',kind,'refundedSeconds',u.refunded_seconds,'secondsRemaining',greatest(0,cap-e.seconds_used),'plan',e.plan);
end; $$;

revoke all on function public.record_session_grant(uuid,uuid,text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.refund_failed_session(uuid,uuid,text) from public,anon,authenticated;
revoke all on function public.consume_entitlement(uuid,integer,uuid) from public,anon,authenticated;
grant execute on function public.record_session_grant(uuid,uuid,text,integer,timestamptz) to service_role;
grant execute on function public.refund_failed_session(uuid,uuid,text) to service_role;
grant execute on function public.consume_entitlement(uuid,integer,uuid) to service_role;

-- Same bounded, single-snapshot export, including issued-session proof.
create or replace function public.export_account_data(p_user_id uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_result jsonb;
begin
  -- Count and measure rows before building the archive. CASE evaluates the
  -- aggregations only when these bounded-preparation checks pass, in the same
  -- statement snapshot; no oversized whole-account JSON is built first.
  with sizes as (
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.learner_state as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.product_events as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.entitlements as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.session_usage as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.session_grants as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.billing_events as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.conversation_packs as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.saved_conversation_text as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.phrase_audio_budgets as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_profiles as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_blocks as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_reports as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_notices as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_reactions as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_edges as row where row.sender = p_user_id or row.recipient = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.social_challenges as row where row.sender = p_user_id or row.recipient = p_user_id
  )
  select case when (select coalesce(sum(bytes), 0) <= 33554432 and coalesce(max(rows), 0) <= 10000 from sizes)
  then jsonb_build_object(
    'learner_state', coalesce((select jsonb_agg(to_jsonb(row)) from public.learner_state as row where row.user_id = p_user_id), '[]'::jsonb),
    'product_events', coalesce((select jsonb_agg(to_jsonb(row)) from public.product_events as row where row.user_id = p_user_id), '[]'::jsonb),
    'entitlements', coalesce((select jsonb_agg(to_jsonb(row)) from public.entitlements as row where row.user_id = p_user_id), '[]'::jsonb),
    'session_usage', coalesce((select jsonb_agg(to_jsonb(row)) from public.session_usage as row where row.user_id = p_user_id), '[]'::jsonb),
    'session_grants', coalesce((select jsonb_agg(to_jsonb(row)) from public.session_grants as row where row.user_id = p_user_id), '[]'::jsonb),
    'billing_events', coalesce((select jsonb_agg(to_jsonb(row)) from public.billing_events as row where row.user_id = p_user_id), '[]'::jsonb),
    'conversation_packs', coalesce((select jsonb_agg(to_jsonb(row)) from public.conversation_packs as row where row.user_id = p_user_id), '[]'::jsonb),
    'saved_conversation_text', coalesce((select jsonb_agg(to_jsonb(row)) from public.saved_conversation_text as row where row.user_id = p_user_id), '[]'::jsonb),
    'phrase_audio_budgets', coalesce((select jsonb_agg(to_jsonb(row)) from public.phrase_audio_budgets as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_profiles', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_profiles as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_blocks', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_blocks as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_reports', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_reports as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_notices', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_notices as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_reactions', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_reactions as row where row.user_id = p_user_id), '[]'::jsonb),
    'social_edges', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_edges as row where row.sender = p_user_id or row.recipient = p_user_id), '[]'::jsonb),
    'social_challenges', coalesce((select jsonb_agg(to_jsonb(row)) from public.social_challenges as row where row.sender = p_user_id or row.recipient = p_user_id), '[]'::jsonb)
  ) else null end into v_result;
  if v_result is null or octet_length(v_result::text) > 33554432 or exists (
    select 1 from jsonb_each(v_result) as part where jsonb_array_length(part.value) > 10000
  ) then raise exception 'account export exceeds preparation limit'; end if;
  return v_result;
end;
$$;
revoke all on function public.export_account_data(uuid) from public, anon, authenticated;
grant execute on function public.export_account_data(uuid) to service_role;
