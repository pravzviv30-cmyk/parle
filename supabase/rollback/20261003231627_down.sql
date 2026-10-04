-- UNISSUED SCHEMA ONLY. Once v1 was ever issued, rollback is admission OFF,
-- drain, and forward-compatible repair. Never drop any issued ledger/proof.
begin;
do $$
begin
  if pg_catalog.current_setting('luvani.lifecycle_rollback_maintenance',true) is distinct from 'approved' then
    raise exception 'explicit lifecycle rollback maintenance interlock required';
  end if;
  if exists(select 1 from public.tutor_session_admission_config where enabled) then
    raise exception 'tutor admission must be disabled before schema rollback';
  end if;
  if exists(select 1 from public.session_grants where lifecycle_version=1)
    or exists(select 1 from public.tutor_session_budget_days where issued_seconds>0) then
    raise exception 'version1 was ever issued: disable admission, drain and forward fix; preserve all proof';
  end if;
end $$;

drop trigger if exists tutor_session_delete_stop on public.session_grants;
drop trigger if exists tutor_allowance_change on public.entitlements;
drop index if exists public.tutor_session_one_live_owner;
drop index if exists public.tutor_session_reconciliation;
drop function if exists public.tutor_session_schema_v1();
drop function if exists public.fence_tutor_account_v1(uuid);
drop function if exists public.reconcile_tutor_sessions_v1(integer,uuid[]);
drop function if exists public.receipt_tutor_session_v1(uuid,uuid);
drop function if exists public.abandon_tutor_session_v1(uuid,uuid);
drop function if exists public.complete_tutor_session_v1(uuid,uuid,uuid,integer,text,integer,integer,text,jsonb);
drop function if exists public.checkpoint_tutor_session_v1(uuid,uuid,uuid,integer,text,integer,integer,text,jsonb);
drop function if exists public.claim_tutor_session_v1(uuid,uuid,text,text,uuid);
drop function if exists public.reserve_tutor_session_v1(uuid,uuid,text,text,text,uuid);
drop function if exists public.active_tutor_identity_v1(uuid,uuid);
drop function if exists luvani_private.tutor_delete_stop_v1();
drop function if exists luvani_private.tutor_allowance_fence_v1();
drop function if exists luvani_private.tutor_finish_v1(uuid,uuid,text,text,jsonb,text,boolean);
drop function if exists luvani_private.tutor_payload_v1(integer,integer,integer,text,jsonb);
drop function if exists luvani_private.tutor_pack_v1(jsonb,uuid,uuid);
drop function if exists luvani_private.tutor_entitlement_v1(uuid);
drop function if exists luvani_private.tutor_hash_v1(jsonb);
-- Restore previous public bodies before removing their new helper dependency.

create or replace function public.record_session_grant(p_user_id uuid,p_session_id uuid,p_plan text,p_seconds_used integer,p_period_end timestamptz)
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

create or replace function public.refund_failed_session(p_user_id uuid,p_session_id uuid,p_failure text)
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


-- Restore the pre-lifecycle bounded export projection.
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

drop function if exists luvani_private.tutor_cap_v1(text);
drop table if exists public.tutor_room_stops;
drop table if exists public.tutor_session_budget_days;
drop table if exists public.tutor_session_admission_config;
drop table if exists luvani_private.tutor_account_fences;
alter table public.session_grants drop constraint if exists session_grants_v1_shape,
  drop column lifecycle_version,drop column state,drop column auth_session_id,drop column room_name,drop column mode,
  drop column request_digest,drop column grant_plan,drop column reserved_seconds,drop column join_deadline,
  drop column claimed_at,drop column hard_deadline,drop column claim_nonce,drop column lease_until,drop column stop_grace_seconds,
  drop column checkpoint_revision,drop column checkpoint_digest,drop column checkpoint_content_hash,drop column checkpoint_seconds,
  drop column checkpoint_learner_turns,drop column checkpoint_failure,drop column checkpoint_baseline,
  drop column completion_digest,drop column completion_content_hash,drop column completion_source,drop column completion_receipt,
  drop column terminal_reason,drop column updated_at;
commit;
