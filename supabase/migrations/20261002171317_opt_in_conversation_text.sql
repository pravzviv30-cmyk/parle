-- Explicit post-session consent. Text is separate from curated learning evidence.
create table public.saved_conversation_text (
  session_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb,
  deleted boolean not null default false,
  saved_at timestamptz not null default now(),
  check ((deleted and payload is null) or (not deleted and jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144))
);
create index saved_conversation_text_owner_time on public.saved_conversation_text(user_id, saved_at desc);
alter table public.saved_conversation_text enable row level security;
revoke all on public.saved_conversation_text from public, anon, authenticated;

-- First accepted save wins. A deleted row retains no words and permanently fences retries.
create function public.save_conversation_text(p_user_id uuid, p_session_id uuid, p_payload jsonb)
returns text language plpgsql security definer set search_path = '' as $$
declare result text;
begin
  perform 1 from public.session_usage where session_id = p_session_id and user_id = p_user_id for key share;
  if not found then return 'not-ready'; end if;
  -- Safety stops never write a pack. Its ready baseline is agent-owned completion proof.
  perform 1 from public.conversation_packs where session_id = p_session_id and user_id = p_user_id and state = 'ready' for key share;
  if not found then return 'not-ready'; end if;
  if p_payload is null or jsonb_typeof(p_payload) <> 'object' or octet_length(p_payload::text) > 262144
    or (p_payload->>'sessionId')::uuid is distinct from p_session_id then raise exception 'invalid conversation text'; end if;
  insert into public.saved_conversation_text(session_id, user_id, payload) values (p_session_id, p_user_id, p_payload)
  on conflict (session_id) do nothing;
  select case when deleted then 'deleted' else 'saved' end into result
  from public.saved_conversation_text where session_id = p_session_id and user_id = p_user_id;
  return coalesce(result, 'not-ready');
end; $$;

create function public.delete_conversation_text(p_user_id uuid, p_session_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.saved_conversation_text set payload = null, deleted = true where session_id = p_session_id and user_id = p_user_id;
  if found then return true; end if;
  perform 1 from public.session_usage where session_id = p_session_id and user_id = p_user_id for key share;
  if not found then return false; end if;
  insert into public.saved_conversation_text(session_id, user_id, payload, deleted) values (p_session_id, p_user_id, null, true)
  on conflict (session_id) do update set payload = null, deleted = true
    where public.saved_conversation_text.user_id = p_user_id;
  return true;
end; $$;
revoke all on function public.save_conversation_text(uuid, uuid, jsonb) from public, anon, authenticated;
revoke all on function public.delete_conversation_text(uuid, uuid) from public, anon, authenticated;
grant execute on function public.save_conversation_text(uuid, uuid, jsonb) to service_role;
grant execute on function public.delete_conversation_text(uuid, uuid) to service_role;

-- All owned server rows are read by one statement/MVCC snapshot. A scalar JSON
-- result avoids PostgREST row caps. No complete-looking partial fallback exists.
create function public.export_account_data(p_user_id uuid) returns jsonb
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
