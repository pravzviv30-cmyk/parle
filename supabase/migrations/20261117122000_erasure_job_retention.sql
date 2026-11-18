-- F1084 (2026-11-17, founder): a finished erasure record is removed 30 days after it
-- completes. Replaces run_data_retention_v1 with the 20261003230224 body plus one
-- bounded batch in the same style as its other deletes: rows of
-- account_erasure_jobs whose completed_at is more than 30 days old. Unfinished jobs
-- are never touched. The result gains an erasureRecordsDeleted count; signature,
-- security definer, search_path, timezone and grants are unchanged.
-- Not removed: conversation_practice_tombstones. Each is a bare random pack id with
-- no owner and no personal data, and it stops a late practice job restoring a pack
-- the learner deleted (docs/PRIVACY_AND_SAFETY.md).
-- The deletion journal, not this table, is what a restore replays, and a restored
-- identity whose record has gone gets a new job from begin_account_erasure_v1.
begin;
set local lock_timeout='5s';
create or replace function public.run_data_retention_v1(p_batch_size integer default 500)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  stamp timestamptz := clock_timestamp(); analytics integer; installations integer; proofs integer; requests integer; erasures integer;
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
  -- F1084: a finished erasure record keeps only the erased account's id and its
  -- processing flags; 30 days after completion it is no longer needed.
  with due as (
    select user_id from public.account_erasure_jobs where completed_at < stamp-interval '30 days'
      order by completed_at,user_id limit p_batch_size for update skip locked
  ), gone as (
    delete from public.account_erasure_jobs j using due where j.user_id=due.user_id returning 1
  ) select count(*)::integer into erasures from gone;
  return jsonb_build_object('analyticsDeleted',analytics,'installationMarkersDeleted',installations,
    'usageProofsPreserved',proofs,'expiredRequestsDeleted',requests,'erasureRecordsDeleted',erasures,'perDatasetLimit',p_batch_size,'ranAt',stamp);
end; $$;
revoke all on function public.run_data_retention_v1(integer) from public,anon,authenticated;
grant execute on function public.run_data_retention_v1(integer) to service_role;
commit;
