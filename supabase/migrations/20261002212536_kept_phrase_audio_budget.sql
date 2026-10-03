-- Operator-managed policy, deliberately dark. No public list price is a verified
-- bound on this account's credits, voice surcharge, minimum charge or USD cost.
create table public.phrase_audio_policy (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  trial_cap_micro_usd bigint not null default 0 check (trial_cap_micro_usd between 0 and 1000000000000),
  paid_cap_micro_usd bigint not null default 0 check (paid_cap_micro_usd between 0 and 1000000000000),
  global_cap_micro_usd bigint not null default 0 check (global_cap_micro_usd between 0 and 1000000000000),
  global_spent_micro_usd bigint not null default 0 check (global_spent_micro_usd >= 0),
  global_window_start timestamptz not null default now() check (isfinite(global_window_start))
);
insert into public.phrase_audio_policy(singleton) values(true);

create table public.phrase_audio_rates (
  voice text primary key check (voice in ('alexandre','emilie','guillaume','marie','anatole','sarah')),
  revision uuid not null default gen_random_uuid(),
  fingerprint text not null check (fingerprint ~ '^[0-9a-f]{64}$'),
  -- A human must verify this conservatively bounds vendor billing, including
  -- character units/voice surcharges/credit conversion, until the expiry below.
  micro_usd_per_utf8_byte numeric(16,6) not null check (micro_usd_per_utf8_byte > 0 and micro_usd_per_utf8_byte <= 1000000),
  fixed_call_micro_usd bigint not null check (fixed_call_micro_usd between 0 and 1000000000000),
  verified_at timestamptz not null check (isfinite(verified_at)),
  expires_at timestamptz not null check (isfinite(expires_at) and expires_at > verified_at and expires_at <= verified_at + interval '30 days')
);
create function public.advance_phrase_audio_rate_revision() returns trigger language plpgsql set search_path = '' as $$
begin new.revision := gen_random_uuid(); return new; end; $$;
revoke all on function public.advance_phrase_audio_rate_revision() from public,anon,authenticated;
create trigger phrase_audio_rate_revision before update on public.phrase_audio_rates for each row execute function public.advance_phrase_audio_rate_revision();
-- No voice-rate rows are seeded. Missing verification refuses generation.
create table public.phrase_audio_budgets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  trial_spent_micro_usd bigint not null default 0 check (trial_spent_micro_usd >= 0),
  paid_spent_micro_usd bigint not null default 0 check (paid_spent_micro_usd >= 0),
  paid_window_start timestamptz check (paid_window_start is null or isfinite(paid_window_start))
);
alter table public.phrase_audio_policy enable row level security;
alter table public.phrase_audio_rates enable row level security;
alter table public.phrase_audio_budgets enable row level security;
revoke all on public.phrase_audio_policy, public.phrase_audio_rates, public.phrase_audio_budgets from public, anon, authenticated;
grant select, insert, update, delete on public.phrase_audio_policy, public.phrase_audio_rates to service_role;
-- Budget mutation is only through the atomic reservation, never a phone API.

create function public.reserve_phrase_audio(p_user_id uuid, p_pack_id uuid, p_kind text, p_index integer, p_voice text, p_fingerprint text)
returns jsonb language plpgsql security definer set search_path = '' set timezone = 'UTC' as $$
declare
  v_policy public.phrase_audio_policy%rowtype;
  v_rate public.phrase_audio_rates%rowtype;
  v_budget public.phrase_audio_budgets%rowtype;
  v_pack public.conversation_packs%rowtype;
  v_entitlement public.entitlements%rowtype;
  v_now timestamptz := clock_timestamp();
  v_french text;
  v_cost numeric;
  v_paid boolean;
  v_global_start timestamptz;
  v_global_spent bigint;
  v_paid_start timestamptz;
  v_account_spent bigint;
  v_account_cap bigint;
begin
  if p_kind is null or p_kind not in ('phrase','correction') or p_index is null or p_index < 0 or p_index > 63
    or p_voice is null or p_fingerprint is null then return null; end if;
  -- Every reservation locks global first, then owner. Lowered caps never erase
  -- old spend. No vendor request runs while these database locks are held.
  select * into v_policy from public.phrase_audio_policy where singleton for update;
  v_now := clock_timestamp();
  if not found or not v_policy.enabled or v_policy.global_cap_micro_usd = 0 then return null; end if;
  select * into v_rate from public.phrase_audio_rates where voice = p_voice and fingerprint = p_fingerprint for share;
  if not found or v_rate.verified_at > v_now or v_rate.expires_at <= v_now then return null; end if;
  perform 1 from auth.users where id = p_user_id for key share;
  if not found then return null; end if;
  select * into v_pack from public.conversation_packs where id = p_pack_id and session_id = p_pack_id and user_id = p_user_id and state = 'ready' for share;
  if not found or v_pack.payload->>'id' is distinct from p_pack_id::text
    or v_pack.payload->>'sessionId' is distinct from p_pack_id::text
    or v_pack.payload->>'learnerId' is distinct from p_user_id::text
    or v_pack.payload->>'state' is distinct from 'ready' then return null; end if;
  perform 1 from public.session_usage where session_id = p_pack_id and user_id = p_user_id for key share;
  if not found then return null; end if;
  if p_kind = 'phrase' then
    if jsonb_typeof(v_pack.payload->'keyPhrases') is distinct from 'array' or jsonb_typeof(v_pack.payload->'keyPhrases'->p_index->'fr') is distinct from 'string' then return null; end if;
    v_french := v_pack.payload->'keyPhrases'->p_index->>'fr';
  else
    if jsonb_typeof(v_pack.payload->'corrections') is distinct from 'array' or jsonb_typeof(v_pack.payload->'corrections'->p_index->'better') is distinct from 'string' then return null; end if;
    v_french := v_pack.payload->'corrections'->p_index->>'better';
  end if;
  -- Server additionally validates the full core schema and identical NFC/trim.
  -- UTF8 bytes upper-bound ordinary character counts, but the operator must
  -- certify the rate also covers this vendor's actual billing rule and fees.
  v_french := normalize(btrim(v_french), NFC);
  if length(v_french) < 1 or length(v_french) > 400 or octet_length(v_french) > 1600 or v_french ~ '[[:cntrl:]]' then return null; end if;
  v_cost := v_rate.fixed_call_micro_usd::numeric + ceil(octet_length(v_french)::numeric * v_rate.micro_usd_per_utf8_byte);
  if v_cost <= 0 or v_cost > 1000000000000 then return null; end if;
  select * into v_entitlement from public.entitlements where user_id = p_user_id for share;
  if not found or v_entitlement.lapsed_from_paid then return null; end if;
  v_paid := v_entitlement.plan in ('starter','regular');
  if v_paid and (v_entitlement.period_end is null or not isfinite(v_entitlement.period_end) or v_entitlement.period_end <= v_now) then return null; end if;
  if not v_paid and v_entitlement.plan <> 'trial' then return null; end if;
  insert into public.phrase_audio_budgets(user_id) values(p_user_id) on conflict (user_id) do nothing;
  select * into v_budget from public.phrase_audio_budgets where user_id = p_user_id for update;
  -- Fixed anchored accounting periods, not a claim of rolling-window limits.
  v_global_start := v_policy.global_window_start;
  v_global_spent := v_policy.global_spent_micro_usd;
  if v_now < v_global_start then return null; end if;
  if v_now >= v_global_start + interval '30 days' then
    v_global_start := v_global_start + floor(extract(epoch from (v_now-v_global_start))/2592000)::bigint * interval '30 days';
    v_global_spent := 0;
  end if;
  if v_paid then
    v_paid_start := coalesce(v_budget.paid_window_start, v_now);
    if v_now < v_paid_start then return null; end if;
    v_account_spent := v_budget.paid_spent_micro_usd;
    if v_now >= v_paid_start + interval '30 days' then
      v_paid_start := v_paid_start + floor(extract(epoch from (v_now-v_paid_start))/2592000)::bigint * interval '30 days';
      v_account_spent := 0;
    end if;
    v_account_cap := v_policy.paid_cap_micro_usd;
  else
    v_account_spent := v_budget.trial_spent_micro_usd;
    v_account_cap := v_policy.trial_cap_micro_usd;
  end if;
  if v_account_spent::numeric + v_cost > v_account_cap or v_global_spent::numeric + v_cost > v_policy.global_cap_micro_usd then return null; end if;
  -- Leave more headroom than this route's whole 20-second HTTP deadline. No
  -- old-period reservation can authorize dispatch in a fresh budget window.
  if v_global_start + interval '30 days' <= v_now + interval '30 seconds'
    or (v_paid and v_paid_start + interval '30 days' <= v_now + interval '30 seconds') then return null; end if;
  update public.phrase_audio_policy set global_window_start = v_global_start, global_spent_micro_usd = v_global_spent + v_cost::bigint where singleton;
  if v_paid then
    update public.phrase_audio_budgets set paid_window_start = v_paid_start, paid_spent_micro_usd = v_account_spent + v_cost::bigint where user_id = p_user_id;
  else
    update public.phrase_audio_budgets set trial_spent_micro_usd = v_account_spent + v_cost::bigint where user_id = p_user_id;
  end if;
  -- One successful call grants ONE dispatch; no replay/free-refund mechanism.
  -- Words are returned transiently, never added to a reservation/event table.
  return jsonb_build_object('fr',v_french,'payload',v_pack.payload,'fingerprint',p_fingerprint,'rateRevision',v_rate.revision,'bucket',case when v_paid then 'paid' else 'trial' end,
    'globalWindowStart',v_global_start,'paidWindowStart',case when v_paid then v_paid_start else null end);
end;
$$;
revoke all on function public.reserve_phrase_audio(uuid,uuid,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.reserve_phrase_audio(uuid,uuid,text,integer,text,text) to service_role;

create function public.phrase_audio_dispatch_allowed(p_user_id uuid,p_pack_id uuid,p_kind text,p_index integer,p_voice text,p_fingerprint text,p_rate_revision uuid,p_expected_fr text,p_bucket text,p_global_window_start timestamptz,p_paid_window_start timestamptz)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists(select 1 from public.phrase_audio_policy as policy, public.phrase_audio_rates as rate,
    public.phrase_audio_budgets as budget, public.conversation_packs as pack, public.session_usage as usage, public.entitlements as entitlement
    where policy.singleton and policy.enabled and policy.global_cap_micro_usd > 0 and policy.global_spent_micro_usd <= policy.global_cap_micro_usd
    and isfinite(p_global_window_start) and policy.global_window_start=p_global_window_start and p_global_window_start <= now()
    and p_global_window_start + interval '2592000 seconds' > now() + interval '30 seconds'
    and rate.voice=p_voice and rate.fingerprint=p_fingerprint and rate.revision=p_rate_revision and rate.verified_at <= now() and rate.expires_at > now()
    and budget.user_id=p_user_id and pack.id=p_pack_id and pack.session_id=p_pack_id and pack.user_id=p_user_id and pack.state='ready'
    and pack.payload->>'id'=p_pack_id::text and pack.payload->>'sessionId'=p_pack_id::text and pack.payload->>'learnerId'=p_user_id::text and pack.payload->>'state'='ready'
    and p_kind in ('phrase','correction') and p_index between 0 and 63
    and normalize(btrim(case p_kind when 'phrase' then pack.payload->'keyPhrases'->p_index->>'fr' else pack.payload->'corrections'->p_index->>'better' end), NFC)=p_expected_fr
    and usage.session_id=p_pack_id and usage.user_id=p_user_id and entitlement.user_id=p_user_id and not entitlement.lapsed_from_paid
    and ((p_bucket='trial' and p_paid_window_start is null and entitlement.plan='trial' and policy.trial_cap_micro_usd > 0 and budget.trial_spent_micro_usd <= policy.trial_cap_micro_usd)
      or (p_bucket='paid' and entitlement.plan in ('starter','regular') and isfinite(entitlement.period_end) and entitlement.period_end > now()
        and isfinite(p_paid_window_start) and budget.paid_window_start=p_paid_window_start and p_paid_window_start <= now()
        and p_paid_window_start + interval '2592000 seconds' > now() + interval '30 seconds'
        and policy.paid_cap_micro_usd > 0 and budget.paid_spent_micro_usd <= policy.paid_cap_micro_usd)));
$$;
revoke all on function public.phrase_audio_dispatch_allowed(uuid,uuid,text,integer,text,text,uuid,text,text,timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.phrase_audio_dispatch_allowed(uuid,uuid,text,integer,text,text,uuid,text,text,timestamptz,timestamptz) to service_role;

-- Preserve the existing single-statement, bounded MVCC archive; include the
-- new owner-specific budget in both its preflight and its result. The global
-- aggregate and verified operator rates contain no owner or phrase identifiers.
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
