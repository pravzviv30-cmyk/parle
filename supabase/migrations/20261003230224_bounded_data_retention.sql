-- Stage 1 retention admission: bounded, indexed, service-only, server-clock driven.
-- This installs a callable routine, not a deployed cron or vendor/backup deletion
-- attestation. An operator must schedule it and monitor failures/backlog before
-- declaring retention effective. No pg_cron extension is silently enabled here.

alter table public.session_usage add column if not exists detail_retention_reviewed_at timestamptz;
create index session_usage_retention_due_idx on public.session_usage(reported_at,session_id)
  where detail_retention_reviewed_at is null;
create index trial_installations_retention_due_idx on public.trial_installations(claimed_at,installation_hash);

create function public.run_data_retention_v1(p_batch_size integer default 500)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  stamp timestamptz := clock_timestamp(); analytics integer; installations integer; proofs integer; requests integer;
begin
  if p_batch_size is null or p_batch_size < 1 or p_batch_size > 1000 then
    raise exception using errcode='22023', message='retention batch size must be between 1 and 1000';
  end if;
  -- Each dataset is independently bounded. SKIP LOCKED avoids waiting on live
  -- inserts, refunds or another retention worker. Returned counts are operational
  -- evidence without account IDs, HMACs, learner content or raw event properties.
  with due as (
    select id from public.product_events where received_at < stamp-interval '13 months'
      order by received_at,id limit p_batch_size for update skip locked
  ), gone as (
    delete from public.product_events e using due where e.id=due.id returning 1
  ) select count(*)::integer into analytics from gone;
  with due as (
    select installation_hash from public.trial_installations where claimed_at < stamp-interval '24 months'
      order by claimed_at,installation_hash limit p_batch_size for update skip locked
  ), gone as (
    delete from public.trial_installations i using due where i.installation_hash=due.installation_hash returning 1
  ) select count(*)::integer into installations from gone;
  -- Preserve every existing financial/completion fence, including seconds, while
  -- recording that this row crossed the detail-policy boundary. Marking is NOT
  -- erasure. No existing field is unambiguously disposable: even the requested
  -- duration is exposed in account export. A separate approved detail/proof model
  -- and truthful policy are still required for the promised speaking-detail TTL.
  with due as (
    select session_id from public.session_usage where reported_at < stamp-interval '24 months'
      and detail_retention_reviewed_at is null
      order by reported_at,session_id limit p_batch_size for update skip locked
  ), marked as (
    update public.session_usage u set detail_retention_reviewed_at=stamp from due
      where u.session_id=due.session_id returning 1
  ) select count(*)::integer into proofs from marked;
  with due as (
    select id from public.social_edges where status='pending' and created_at <= stamp-interval '14 days'
      order by created_at,id limit p_batch_size for update skip locked
  ), gone as (
    delete from public.social_edges e using due where e.id=due.id returning 1
  ) select count(*)::integer into requests from gone;
  return jsonb_build_object('analyticsDeleted',analytics,'installationMarkersDeleted',installations,
    'usageProofsPreserved',proofs,'expiredRequestsDeleted',requests,'perDatasetLimit',p_batch_size,'ranAt',stamp);
end; $$;
revoke all on function public.run_data_retention_v1(integer) from public,anon,authenticated;
grant execute on function public.run_data_retention_v1(integer) to service_role;
