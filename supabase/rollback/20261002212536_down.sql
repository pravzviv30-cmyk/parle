-- Disable the worker first and back up budgets before rolling back. Removing
-- counters destroys spend history; reapplying starts dark and cannot safely
-- enable spending from an older snapshot. No learning words are deleted.
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
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.billing_events as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.conversation_packs as row where row.user_id = p_user_id
    union all
    select count(*) as rows, coalesce(sum(octet_length(to_jsonb(row)::text)), 0) as bytes from public.saved_conversation_text as row where row.user_id = p_user_id
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
    'billing_events', coalesce((select jsonb_agg(to_jsonb(row)) from public.billing_events as row where row.user_id = p_user_id), '[]'::jsonb),
    'conversation_packs', coalesce((select jsonb_agg(to_jsonb(row)) from public.conversation_packs as row where row.user_id = p_user_id), '[]'::jsonb),
    'saved_conversation_text', coalesce((select jsonb_agg(to_jsonb(row)) from public.saved_conversation_text as row where row.user_id = p_user_id), '[]'::jsonb),
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

drop function if exists public.reserve_phrase_audio(uuid,uuid,text,integer,text,text);
drop function if exists public.phrase_audio_dispatch_allowed(uuid,uuid,text,integer,text,text,uuid,text,text,timestamptz,timestamptz);
drop table if exists public.phrase_audio_budgets;
drop trigger if exists phrase_audio_rate_revision on public.phrase_audio_rates;
drop table if exists public.phrase_audio_rates;
drop function if exists public.advance_phrase_audio_rate_revision();
drop table if exists public.phrase_audio_policy;
