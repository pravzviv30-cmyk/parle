-- A20 authority. OFF/zero defaults, no vendor prices. Integer microUSD quotes
-- are operator-reviewed worst-case envelopes, not usage estimates/invoice proof.
begin;
create table luvani_private.paid_admission_config (
 singleton boolean primary key default true check(singleton), enabled boolean not null default false,
 ever_issued boolean not null default false,
 global_daily_micro_usd bigint not null default 0 check(global_daily_micro_usd between 0 and 1000000000000),
 account_daily_micro_usd bigint not null default 0 check(account_daily_micro_usd between 0 and 1000000000000),
 global_daily_operations integer not null default 0 check(global_daily_operations between 0 and 1000000),
 account_daily_operations integer not null default 0 check(account_daily_operations between 0 and 1000000),
 global_daily_calls integer not null default 0 check(global_daily_calls between 0 and 1000000),
 account_daily_calls integer not null default 0 check(account_daily_calls between 0 and 1000000),
 reviewed_by text,evidence_url text,evidence_sha256 text,expires_at timestamptz
);
insert into luvani_private.paid_admission_config(singleton) values(true);
create table luvani_private.paid_admission_vendors (
 provider text primary key check(provider in ('anthropic','openai','groq','deepgram','elevenlabs','fish','toneperfect','speechace','typesafe')),
 enabled boolean not null default false,
 daily_micro_usd bigint not null default 0 check(daily_micro_usd between 0 and 1000000000000),
 daily_operations integer not null default 0 check(daily_operations between 0 and 1000000),
 daily_calls integer not null default 0 check(daily_calls between 0 and 1000000)
);
insert into luvani_private.paid_admission_vendors(provider)
 select unnest(array['anthropic','openai','groq','deepgram','elevenlabs','fish','toneperfect','speechace','typesafe']);
create table luvani_private.paid_quotes (
 id uuid primary key, enabled boolean not null default false, definition jsonb not null,
 created_at timestamptz not null default clock_timestamp()
);
create table luvani_private.paid_global_days (
 day date primary key, micro_usd bigint not null default 0 check(micro_usd between 0 and 1000000000000),
 operations integer not null default 0 check(operations between 0 and 1000000),
 calls integer not null default 0 check(calls between 0 and 1000000)
);
create table luvani_private.paid_vendor_days (
 day date not null,provider text not null references luvani_private.paid_admission_vendors(provider),
 micro_usd bigint not null default 0 check(micro_usd between 0 and 1000000000000),
 operations integer not null default 0 check(operations between 0 and 1000000),
 calls integer not null default 0 check(calls between 0 and 1000000),primary key(day,provider)
);
create table luvani_private.paid_account_days (
 user_id uuid not null references auth.users(id) on delete cascade,day date not null,
 micro_usd bigint not null default 0 check(micro_usd between 0 and 1000000000000),
 operations integer not null default 0 check(operations between 0 and 1000000),
 calls integer not null default 0 check(calls between 0 and 1000000),primary key(user_id,day)
);
create table luvani_private.paid_operations (
 id uuid primary key,user_id uuid not null references auth.users(id) on delete cascade,
 quote_id uuid not null references luvani_private.paid_quotes(id),activity text not null,
 configuration_sha256 text not null,request_digest text not null,context jsonb not null,
 quote_definition jsonb not null,request_hash text not null,day date not null,
 micro_usd bigint not null,calls integer not null,created_at timestamptz not null default clock_timestamp(),
 unique(user_id,activity,context)
);
-- API callers need fresh operation identities per deliberate retry. API context
-- therefore includes operationId, while tutor/practice identity admits once.
create table luvani_private.paid_effects (
 operation_id uuid not null references luvani_private.paid_operations(id) on delete cascade,
 effect_id uuid not null,component_key text not null,request_hash text not null,
 execution_day date not null,provider_calls integer not null check(provider_calls between 1 and 16),
 dispatch_until timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),primary key(operation_id,effect_id)
);
create index paid_effect_component_v1 on luvani_private.paid_effects(operation_id,component_key);
-- Separate execution-start-day limits; reservation-day exposure stays booked.
-- Charge the entire component envelope once per operation/component/day and
-- the finite provider-attempt envelope for each newly admitted logical effect.
create table luvani_private.paid_execution_global_days (
 day date primary key,micro_usd bigint not null check(micro_usd between 0 and 1000000000000),
 calls integer not null check(calls between 0 and 1000000)
);
create table luvani_private.paid_execution_account_days (
 user_id uuid not null references auth.users(id)on delete cascade,day date not null,
 micro_usd bigint not null check(micro_usd between 0 and 1000000000000),
 calls integer not null check(calls between 0 and 1000000),primary key(user_id,day)
);
create table luvani_private.paid_execution_vendor_days (
 day date not null,provider text not null references luvani_private.paid_admission_vendors(provider),
 micro_usd bigint not null check(micro_usd between 0 and 1000000000000),
 calls integer not null check(calls between 0 and 1000000),primary key(day,provider)
);
create table luvani_private.paid_component_days (
 operation_id uuid not null references luvani_private.paid_operations(id)on delete cascade,
 component_key text not null,day date not null,micro_usd bigint not null check(micro_usd between 1 and 1000000000000),
 primary key(operation_id,component_key,day)
);
alter table public.tutor_session_admission_config
 add column max_account_daily_sessions integer not null default 0 check(max_account_daily_sessions between 0 and 1000),
 add column max_account_daily_seconds integer not null default 0 check(max_account_daily_seconds between 0 and 900000);
create table luvani_private.tutor_account_budget_days (
 user_id uuid not null references auth.users(id) on delete cascade,day date not null,
 issued_sessions integer not null default 0 check(issued_sessions between 0 and 1000000),
 issued_seconds bigint not null default 0 check(issued_seconds between 0 and 86400000),primary key(user_id,day)
);
-- Existing v1 grant creation timestamps are the best surviving owner baseline;
-- no prior grant/usage/global proof is removed. If an older owner was erased,
-- there is no owner identifier to reconstruct; its global exposure still holds.
insert into luvani_private.tutor_account_budget_days(user_id,day,issued_sessions,issued_seconds)
 select user_id,(created_at at time zone 'UTC')::date,count(*)::integer,sum(reserved_seconds)
 from public.session_grants where lifecycle_version=1 group by user_id,(created_at at time zone 'UTC')::date;
-- Global/vendor aggregates intentionally have no owner FK or owner identifiers.
-- Auth erasure cascades owner counters/operations/effects, never returns exposure.
alter table luvani_private.paid_admission_config enable row level security;
alter table luvani_private.paid_admission_vendors enable row level security;
alter table luvani_private.paid_quotes enable row level security;
alter table luvani_private.paid_global_days enable row level security;
alter table luvani_private.paid_vendor_days enable row level security;
alter table luvani_private.paid_account_days enable row level security;
alter table luvani_private.paid_operations enable row level security;
alter table luvani_private.paid_effects enable row level security;
alter table luvani_private.tutor_account_budget_days enable row level security;
alter table luvani_private.paid_execution_global_days enable row level security;
alter table luvani_private.paid_execution_account_days enable row level security;
alter table luvani_private.paid_execution_vendor_days enable row level security;
alter table luvani_private.paid_component_days enable row level security;
revoke all on luvani_private.paid_admission_config,luvani_private.paid_admission_vendors,luvani_private.paid_quotes,
 luvani_private.paid_global_days,luvani_private.paid_vendor_days,luvani_private.paid_account_days,
 luvani_private.paid_operations,luvani_private.paid_effects,luvani_private.tutor_account_budget_days,
 luvani_private.paid_execution_global_days,luvani_private.paid_execution_account_days,
 luvani_private.paid_execution_vendor_days,luvani_private.paid_component_days
 from public,anon,authenticated,service_role;

create function luvani_private.paid_review_v1(p_reviewer text,p_url text,p_hash text,p_expiry timestamptz)
returns void language plpgsql set search_path='' as $$
begin
 if p_reviewer is null or length(trim(p_reviewer)) not between 3 and 200 or p_url is null or length(p_url)>2048
  or p_url !~ '^https://[^/@?#[:space:]]+([/?#][^[:space:]]*)?$' or p_hash is null or p_hash !~ '^[0-9a-f]{64}$'
  or p_hash=repeat(left(p_hash,1),64) or p_expiry is null or p_expiry<=clock_timestamp()
  or p_expiry>clock_timestamp()+interval '7 days' then
  raise exception using errcode='PT400',message='current reviewed paid evidence required'; end if;
end $$;
create function luvani_private.paid_config_review_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op<>'UPDATE' then raise exception using errcode='PT409',message='paid config singleton immutable'; end if;
 new.ever_issued:=old.ever_issued or new.ever_issued;
 if new.enabled then
  if least(new.global_daily_micro_usd,new.account_daily_micro_usd,new.global_daily_operations,
    new.account_daily_operations,new.global_daily_calls,new.account_daily_calls)<=0 then
   raise exception using errcode='PT400',message='finite positive paid budgets required'; end if;
  perform luvani_private.paid_review_v1(new.reviewed_by,new.evidence_url,new.evidence_sha256,new.expires_at);
 end if;
 return new;
end $$;
create trigger paid_config_review_v1 before insert or update or delete on luvani_private.paid_admission_config
 for each row execute function luvani_private.paid_config_review_v1();

create function luvani_private.paid_quote_valid_v1(p jsonb) returns void
language plpgsql set search_path='' as $$
declare c jsonb;key text;keys text[];total bigint:=0;calls bigint:=0;qty bigint;
begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32768
  or (select array_agg(k order by k) from jsonb_object_keys(p)k) is distinct from
    array['activity','components','configurationSha256','evidenceSha256','evidenceUrl','expiresAt','reviewedBy']::text[]
  or p->>'activity' not in ('lesson','lesson-text','convo','convo-text','practice','api-transcribe','api-score','api-judge','api-fix-observer','api-fix-judge','phrase-audio','operator-warm','operator-eval')
  or p->>'configurationSha256' is null or p->>'configurationSha256' !~ '^[0-9a-f]{64}$'
  or jsonb_typeof(p->'components')<>'array' or jsonb_array_length(p->'components') not between 1 and 16 then
  raise exception using errcode='PT400',message='invalid paid quote shape'; end if;
 foreach key in array array['activity','configurationSha256','evidenceSha256','evidenceUrl','expiresAt','reviewedBy'] loop
  if jsonb_typeof(p->key) is distinct from 'string' then raise exception using errcode='PT400',message='paid quote identity must be text'; end if;
 end loop;
 perform luvani_private.paid_review_v1(p->>'reviewedBy',p->>'evidenceUrl',p->>'evidenceSha256',(p->>'expiresAt')::timestamptz);
 for c in select value from jsonb_array_elements(p->'components') loop
  if jsonb_typeof(c)<>'object' or (select array_agg(k order by k) from jsonb_object_keys(c)k) is distinct from
    array['configurationSha256','key','kind','maxAudioMillis','maxEffects','maxInputBytes','maxOutputTokens','maxProviderAttempts','maxTextBytes','microUsd','model','provider','voice']::text[]
   or c->>'key' is null or c->>'key' !~ '^[a-z][a-z0-9_-]{0,63}$'
   or c->>'provider' not in ('anthropic','openai','groq','deepgram','elevenlabs','fish','toneperfect','speechace','typesafe')
   or c->>'kind' not in ('llm','stt','tts','scoring','observer')
   or c->>'model' is null or c->>'model' !~ '^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$'
   or c->>'voice' is null or length(c->>'voice')>128
   or c->>'configurationSha256' is null or c->>'configurationSha256' !~ '^[0-9a-f]{64}$' then
   raise exception using errcode='PT400',message='invalid paid component identity'; end if;
  foreach key in array array['configurationSha256','key','kind','model','provider','voice'] loop
   if jsonb_typeof(c->key) is distinct from 'string' then raise exception using errcode='PT400',message='paid component identity must be text'; end if;
  end loop;
  foreach key in array array['maxAudioMillis','maxEffects','maxInputBytes','maxOutputTokens','maxProviderAttempts','maxTextBytes','microUsd'] loop
   if jsonb_typeof(c->key) is distinct from 'number' or c->>key !~ '^[0-9]+$' then
    raise exception using errcode='PT400',message='paid quantities must be integer units'; end if;
   qty:=(c->>key)::bigint;
   if qty>(case key when 'microUsd' then 1000000000000 when 'maxEffects' then 1024 when 'maxProviderAttempts' then 16
     when 'maxInputBytes' then 2097152 when 'maxOutputTokens' then 100000 when 'maxAudioMillis' then 900000 when 'maxTextBytes' then 262144 else 0 end)
    or (key in ('microUsd','maxEffects','maxProviderAttempts') and qty<1) then
    raise exception using errcode='PT400',message='paid quantity outside supported finite bound'; end if;
  end loop;
  if (c->>'kind' in ('llm','observer') and ((c->>'maxInputBytes')::bigint=0 or (c->>'maxOutputTokens')::bigint=0 or (c->>'maxAudioMillis')::bigint<>0 or (c->>'maxTextBytes')::bigint<>0 or c->>'voice'<>''))
   or (c->>'kind'='stt' and ((c->>'maxAudioMillis')::bigint=0 or (c->>'maxOutputTokens')::bigint<>0 or (c->>'maxTextBytes')::bigint<>0 or c->>'voice'<>''))
   or (c->>'kind'='tts' and ((c->>'maxTextBytes')::bigint=0 or (c->>'maxInputBytes')::bigint<>0 or (c->>'maxOutputTokens')::bigint<>0 or (c->>'maxAudioMillis')::bigint<>0 or c->>'voice'=''))
   or (c->>'kind'='scoring' and ((c->>'maxAudioMillis')::bigint=0 or (c->>'maxTextBytes')::bigint=0 or (c->>'maxOutputTokens')::bigint<>0 or c->>'voice'<>'')) then
   raise exception using errcode='PT400',message='applicable paid dimensions must be positive and irrelevant ones zero'; end if;
  total:=total+(c->>'microUsd')::bigint;calls:=calls+(c->>'maxEffects')::bigint*(c->>'maxProviderAttempts')::bigint;
 end loop;
 if total>1000000000000 or calls>1024 or (select count(distinct value->>'key') from jsonb_array_elements(p->'components'))<>jsonb_array_length(p->'components') then
  raise exception using errcode='PT400',message='paid quote total/call/key bound exceeded'; end if;
 if (p->>'activity' in ('lesson-text','convo-text','practice','api-judge','api-fix-judge') and exists(select 1 from jsonb_array_elements(p->'components')entry(value) where entry.value->>'kind'<>'llm'))
  or (p->>'activity' in ('lesson','convo') and not (select array_agg(distinct entry.value->>'kind') from jsonb_array_elements(p->'components')entry(value)) @> array['llm','stt','tts'])
  or (p->>'activity'='api-transcribe' and exists(select 1 from jsonb_array_elements(p->'components')entry(value) where entry.value->>'kind'<>'stt'))
  or (p->>'activity'='api-score' and exists(select 1 from jsonb_array_elements(p->'components')entry(value) where entry.value->>'kind'<>'scoring'))
  or (p->>'activity'='api-fix-observer' and exists(select 1 from jsonb_array_elements(p->'components')entry(value) where entry.value->>'kind'<>'observer'))
  or (p->>'activity'='phrase-audio' and exists(select 1 from jsonb_array_elements(p->'components')entry(value) where entry.value->>'kind'<>'tts')) then
  raise exception using errcode='PT400',message='paid activity component mismatch'; end if;
end $$;
-- Before statement lock avoids quote-row -> global-config inversion. Owner-only
-- writes cannot race the 4096 retained immutable quote revision ceiling.
create function luvani_private.paid_quote_insert_lock_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from luvani_private.paid_admission_config where singleton for update;
 return null;
end $$;
create trigger paid_quote_insert_lock_v1 before insert on luvani_private.paid_quotes
 for each statement execute function luvani_private.paid_quote_insert_lock_v1();
create function luvani_private.paid_quote_review_v1() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id is distinct from old.id or new.definition is distinct from old.definition or new.created_at is distinct from old.created_at) then
  raise exception using errcode='PT409',message='paid quote revision is immutable'; end if;
 if tg_op='INSERT' and (select count(*) from luvani_private.paid_quotes)>=4096 then
  raise exception using errcode='PT429',message='retained paid quote revision limit'; end if;
 if tg_op='INSERT' or new.enabled then perform luvani_private.paid_quote_valid_v1(new.definition); end if;
 return new;
end $$;
create trigger paid_quote_review_v1 before insert or update on luvani_private.paid_quotes
 for each row execute function luvani_private.paid_quote_review_v1();

-- Validate shape BEFORE child/counter locks. Auth parent -> paid config ->
-- entitlement/grant OR pack advisory/pack/job -> global/account/sorted vendor
-- counters -> operation/effect. Completion/erasure never acquires paid config.
create function luvani_private.paid_context_shape_v1(p jsonb,p_dispatch boolean,p_operation_id uuid)
returns void language plpgsql set search_path='' as $$
declare keys text[]; k text;
begin
 if p is null or p_dispatch is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>512 then
  raise exception using errcode='PT400',message='invalid paid context'; end if;
 select array_agg(key order by key) into keys from jsonb_object_keys(p)key;
 if (p->>'kind'='api' and keys is distinct from array['authSessionId','kind','operationId'])
  or (p->>'kind'='tutor' and keys is distinct from (case when p_dispatch then array['claimNonce','kind','sessionId'] else array['kind','sessionId'] end))
  or (p->>'kind'='practice' and keys is distinct from array['kind','leaseToken','packId']) or p->>'kind' is null or p->>'kind' not in ('api','tutor','practice') then
  raise exception using errcode='PT400',message='invalid paid context fields'; end if;
 foreach k in array keys loop
  if k<>'kind' and (jsonb_typeof(p->k) is distinct from 'string' or p->>k !~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$') then
   raise exception using errcode='PT400',message='invalid paid context UUID'; end if;
 end loop;
 if p->>'kind'='api' and (p->>'operationId')::uuid is distinct from p_operation_id then
  raise exception using errcode='PT400',message='paid API operation identity mismatch'; end if;
end $$;
create function luvani_private.paid_context_active_v1(p_owner uuid,p jsonb,p_dispatch boolean,p_activity text,p_quote jsonb)
returns boolean language plpgsql security definer set search_path='' as $$
declare g public.session_grants;e public.entitlements;j public.conversation_practice_jobs;owner_id uuid;
begin
 if exists(select 1 from luvani_private.tutor_account_fences where user_id=p_owner)
  or not exists(select 1 from auth.users u where u.id=p_owner and to_jsonb(u)->>'deleted_at' is null
    and (to_jsonb(u)->>'banned_until' is null or (to_jsonb(u)->>'banned_until')::timestamptz<=clock_timestamp())) then return false; end if;
 if p->>'kind'='api' then
  if p_activity not in ('api-transcribe','api-score','api-judge','api-fix-observer','api-fix-judge','phrase-audio','operator-warm','operator-eval') then return false; end if;
  return public.active_tutor_identity_v1(p_owner,(p->>'authSessionId')::uuid);
 elsif p->>'kind'='tutor' then
  e:=luvani_private.tutor_entitlement_v1(p_owner);if e.user_id is null then return false; end if;
  select * into g from public.session_grants where session_id=(p->>'sessionId')::uuid and user_id=p_owner for update;
  if not found or g.lifecycle_version<>1 or g.mode<>p_activity or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan
   or not public.active_tutor_identity_v1(p_owner,g.auth_session_id) then return false; end if;
  if p_dispatch then
   if g.state<>'active' or g.claim_nonce is distinct from (p->>'claimNonce')::uuid
    or g.lease_until<=clock_timestamp() or g.hard_deadline<=clock_timestamp() then return false; end if;
  elsif g.state<>'reserved' or g.join_deadline<=clock_timestamp() then return false;
  end if;
  if g.mode in ('lesson','convo') and not exists(select 1 from jsonb_array_elements(p_quote->'components')c
    where c->>'kind'='stt' and (c->>'maxAudioMillis')::bigint>=g.reserved_seconds*1000) then return false; end if;
  return true;
 elsif p->>'kind'='practice' then
  if p_activity<>'practice' then return false; end if;
  perform pg_advisory_xact_lock(hashtextextended(p->>'packId',0));
  select user_id into owner_id from public.conversation_packs where id=(p->>'packId')::uuid and state='ready' for update;
  if not found or owner_id<>p_owner or exists(select 1 from public.conversation_practice_tombstones where pack_id=(p->>'packId')::uuid) then return false; end if;
  select * into j from public.conversation_practice_jobs where pack_id=(p->>'packId')::uuid for update;
  return found and j.status='running' and j.lease_token=(p->>'leaseToken')::uuid and j.lease_until>clock_timestamp();
 end if;
 return false;
end $$;

create function public.reserve_paid_operation_v1(p_user_id uuid,p_operation_id uuid,p_quote_id uuid,p_configuration_sha256 text,p_context jsonb,p_request_digest text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg luvani_private.paid_admission_config;q luvani_private.paid_quotes;op luvani_private.paid_operations;
 gd luvani_private.paid_global_days;ad luvani_private.paid_account_days;vd luvani_private.paid_vendor_days;
 vendor record;vc luvani_private.paid_admission_vendors;stamp timestamptz;day_key date;amount bigint;calls_total integer;request_hash text;
begin
 if p_user_id is null or p_operation_id is null or p_quote_id is null or p_configuration_sha256 is null or p_configuration_sha256 !~ '^[0-9a-f]{64}$'
  or p_request_digest is null or p_request_digest !~ '^[0-9a-f]{64}$' then raise exception using errcode='PT400',message='invalid paid reservation'; end if;
 perform luvani_private.paid_context_shape_v1(p_context,false,p_operation_id);
 perform 1 from auth.users where id=p_user_id for key share;if not found then return jsonb_build_object('kind','refused','reason','inactive-owner');end if;
 select * into cfg from luvani_private.paid_admission_config where singleton for update;
 select * into q from luvani_private.paid_quotes where id=p_quote_id;
 if q.id is null or q.definition->>'configurationSha256'<>p_configuration_sha256 then return jsonb_build_object('kind','refused','reason','quote-mismatch');end if;
 select * into op from luvani_private.paid_operations where id=p_operation_id;
 -- Replayed tutor receipt uses the current authoritative worker fence internally,
 -- without ever returning that nonce to this caller. Dispatch requires the caller's
 -- actual nonce in its separate effect claim.
 if op.id is not null and p_context->>'kind'='tutor' then
  if not luvani_private.paid_context_active_v1(p_user_id,p_context||jsonb_build_object('claimNonce',
    (select claim_nonce from public.session_grants where session_id=(p_context->>'sessionId')::uuid and user_id=p_user_id)),true,q.definition->>'activity',q.definition)
    and not luvani_private.paid_context_active_v1(p_user_id,p_context,false,q.definition->>'activity',q.definition) then
   return jsonb_build_object('kind','refused','reason','inactive-context'); end if;
 elsif not luvani_private.paid_context_active_v1(p_user_id,p_context,false,q.definition->>'activity',q.definition) then
  return jsonb_build_object('kind','refused','reason','inactive-context');end if;
 stamp:=clock_timestamp();day_key:=(stamp at time zone 'UTC')::date;
 request_hash:=luvani_private.tutor_hash_v1(jsonb_build_object('owner',p_user_id,'id',p_operation_id,'quote',p_quote_id,'config',p_configuration_sha256,'context',p_context,'digest',p_request_digest));
 select * into op from luvani_private.paid_operations where id=p_operation_id for update;
 if found then
  if op.user_id<>p_user_id or op.request_hash<>request_hash then raise exception using errcode='PT409',message='paid operation identity conflict';end if;
  return jsonb_build_object('kind','reserved','version',1,'operationId',op.id,'quoteId',op.quote_id,'configurationSha256',op.configuration_sha256,'activity',op.activity,'requestDigest',op.request_digest,'components',op.quote_definition->'components','expiresAt',op.quote_definition->>'expiresAt','day',op.day,'microUsd',op.micro_usd,'providerCalls',op.calls,'replayed',true);
 end if;
 if not cfg.enabled or cfg.expires_at is null or cfg.expires_at<=stamp then return jsonb_build_object('kind','refused','reason','admission-disabled');end if;
 if not q.enabled or (q.definition->>'expiresAt')::timestamptz<=stamp then return jsonb_build_object('kind','refused','reason','quote-disabled');end if;
 -- Only one admitted envelope per tutor grant/practice lease; fresh API operation
 -- identities are explicitly counted again, including each deliberate retry.
 if exists(select 1 from luvani_private.paid_operations where user_id=p_user_id and activity=q.definition->>'activity' and context=p_context) then
  return jsonb_build_object('kind','refused','reason','context-already-reserved');end if;
 select sum((c->>'microUsd')::bigint),sum((c->>'maxEffects')::integer*(c->>'maxProviderAttempts')::integer) into amount,calls_total from jsonb_array_elements(q.definition->'components')c;
 select * into gd from luvani_private.paid_global_days where day=day_key for update;
 select * into ad from luvani_private.paid_account_days where user_id=p_user_id and day=day_key for update;
 if coalesce(gd.micro_usd,0)+amount>cfg.global_daily_micro_usd or coalesce(gd.operations,0)+1>cfg.global_daily_operations or coalesce(gd.calls,0)+calls_total>cfg.global_daily_calls then return jsonb_build_object('kind','refused','reason','global-budget');end if;
 if coalesce(ad.micro_usd,0)+amount>cfg.account_daily_micro_usd or coalesce(ad.operations,0)+1>cfg.account_daily_operations or coalesce(ad.calls,0)+calls_total>cfg.account_daily_calls then return jsonb_build_object('kind','refused','reason','account-budget');end if;
 for vendor in select c->>'provider' as provider,sum((c->>'microUsd')::bigint) as cost,sum((c->>'maxEffects')::integer*(c->>'maxProviderAttempts')::integer) as calls from jsonb_array_elements(q.definition->'components')c group by c->>'provider' order by c->>'provider' loop
  select * into vc from luvani_private.paid_admission_vendors where provider=vendor.provider;
  select * into vd from luvani_private.paid_vendor_days where day=day_key and provider=vendor.provider for update;
  if not coalesce(vc.enabled,false) or coalesce(vd.micro_usd,0)+vendor.cost>vc.daily_micro_usd or coalesce(vd.operations,0)+1>vc.daily_operations or coalesce(vd.calls,0)+vendor.calls>vc.daily_calls then return jsonb_build_object('kind','refused','reason','vendor-budget');end if;
 end loop;
 insert into luvani_private.paid_global_days(day,micro_usd,operations,calls) values(day_key,amount,1,calls_total)
  on conflict(day)do update set micro_usd=luvani_private.paid_global_days.micro_usd+amount,operations=luvani_private.paid_global_days.operations+1,calls=luvani_private.paid_global_days.calls+calls_total;
 insert into luvani_private.paid_account_days(user_id,day,micro_usd,operations,calls) values(p_user_id,day_key,amount,1,calls_total)
  on conflict(user_id,day)do update set micro_usd=luvani_private.paid_account_days.micro_usd+amount,operations=luvani_private.paid_account_days.operations+1,calls=luvani_private.paid_account_days.calls+calls_total;
 for vendor in select c->>'provider' as provider,sum((c->>'microUsd')::bigint) as cost,sum((c->>'maxEffects')::integer*(c->>'maxProviderAttempts')::integer) as calls from jsonb_array_elements(q.definition->'components')c group by c->>'provider' order by c->>'provider' loop
  insert into luvani_private.paid_vendor_days(day,provider,micro_usd,operations,calls) values(day_key,vendor.provider,vendor.cost,1,vendor.calls)
   on conflict(day,provider)do update set micro_usd=luvani_private.paid_vendor_days.micro_usd+vendor.cost,operations=luvani_private.paid_vendor_days.operations+1,calls=luvani_private.paid_vendor_days.calls+vendor.calls;
 end loop;
 insert into luvani_private.paid_operations(id,user_id,quote_id,activity,configuration_sha256,request_digest,context,quote_definition,request_hash,day,micro_usd,calls)
  values(p_operation_id,p_user_id,q.id,q.definition->>'activity',p_configuration_sha256,p_request_digest,p_context,q.definition,request_hash,day_key,amount,calls_total);
 update luvani_private.paid_admission_config set ever_issued=true where singleton;
 return jsonb_build_object('kind','reserved','version',1,'operationId',p_operation_id,'quoteId',q.id,'configurationSha256',p_configuration_sha256,'activity',q.definition->>'activity','requestDigest',p_request_digest,'components',q.definition->'components','expiresAt',q.definition->>'expiresAt','day',day_key,'microUsd',amount,'providerCalls',calls_total,'replayed',false);
end $$;

create function public.claim_paid_effect_v1(p_user_id uuid,p_operation_id uuid,p_effect_id uuid,p_component_key text,p_configuration_sha256 text,p_quantities jsonb,p_max_provider_attempts integer,p_context jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg luvani_private.paid_admission_config;op luvani_private.paid_operations;q luvani_private.paid_quotes;c jsonb;
 effect luvani_private.paid_effects;key text;limit_key text;stamp timestamptz;body_hash text;normal_context jsonb;
 day_key date;cost bigint;attempts integer;until_at timestamptz;vc luvani_private.paid_admission_vendors;
 gd luvani_private.paid_execution_global_days;ad luvani_private.paid_execution_account_days;
 vd luvani_private.paid_execution_vendor_days;
begin
 if p_user_id is null or p_operation_id is null or p_effect_id is null or p_component_key is null or p_component_key !~ '^[a-z][a-z0-9_-]{0,63}$'
  or p_configuration_sha256 is null or p_configuration_sha256 !~ '^[0-9a-f]{64}$' or p_max_provider_attempts is null or p_max_provider_attempts not between 1 and 16
  or p_quantities is null or jsonb_typeof(p_quantities)<>'object' or octet_length(p_quantities::text)>256
  or (select array_agg(k order by k)from jsonb_object_keys(p_quantities)k) is distinct from array['audioMillis','inputBytes','outputTokens','textBytes']::text[] then
  raise exception using errcode='PT400',message='invalid paid effect shape';end if;
 foreach key in array array['audioMillis','inputBytes','outputTokens','textBytes'] loop
  if jsonb_typeof(p_quantities->key) is distinct from 'number' or p_quantities->>key !~ '^[0-9]+$' or (p_quantities->>key)::numeric>2097152 then
   raise exception using errcode='PT400',message='invalid paid effect integer quantities';end if;
 end loop;
 perform luvani_private.paid_context_shape_v1(p_context,true,p_operation_id);
 perform 1 from auth.users where id=p_user_id for key share;if not found then return jsonb_build_object('kind','refused','reason','inactive-owner');end if;
 select * into cfg from luvani_private.paid_admission_config where singleton for update;
 select * into op from luvani_private.paid_operations where id=p_operation_id;
 if op.id is null or op.user_id<>p_user_id then return jsonb_build_object('kind','refused','reason','not-reserved');end if;
 normal_context:=case when p_context->>'kind'='tutor' then p_context-'claimNonce' else p_context end;
 if normal_context<>op.context then raise exception using errcode='PT409',message='paid effect context conflict';end if;
 if not luvani_private.paid_context_active_v1(p_user_id,p_context,true,op.activity,op.quote_definition) then return jsonb_build_object('kind','refused','reason','inactive-context');end if;
 stamp:=clock_timestamp();
 select * into q from luvani_private.paid_quotes where id=op.quote_id;
 if not cfg.enabled or cfg.expires_at is null or cfg.expires_at<=stamp or not coalesce(q.enabled,false) or (q.definition->>'expiresAt')::timestamptz<=stamp then return jsonb_build_object('kind','refused','reason','admission-disabled');end if;
 select value into c from jsonb_array_elements(op.quote_definition->'components') where value->>'key'=p_component_key;
 if c is null or c->>'configurationSha256'<>p_configuration_sha256 or (c->>'maxProviderAttempts')::integer<>p_max_provider_attempts then return jsonb_build_object('kind','refused','reason','quote-mismatch');end if;
 if not coalesce((select enabled from luvani_private.paid_admission_vendors where provider=c->>'provider'),false) then return jsonb_build_object('kind','refused','reason','vendor-disabled');end if;
 foreach key in array array['audioMillis','inputBytes','outputTokens','textBytes'] loop
  limit_key:='max'||upper(left(key,1))||substr(key,2);
  if (p_quantities->>key)::bigint>(c->>limit_key)::bigint or ((c->>limit_key)::bigint>0 and (p_quantities->>key)::bigint=0) then return jsonb_build_object('kind','refused','reason','quantity-limit');end if;
 end loop;
 -- Global config serializes concurrent effects, including first-row creation.
 select * into op from luvani_private.paid_operations where id=p_operation_id for update;
 body_hash:=luvani_private.tutor_hash_v1(jsonb_build_object('component',p_component_key,'configuration',p_configuration_sha256,'quantities',p_quantities,'attempts',p_max_provider_attempts,'context',p_context));
 select * into effect from luvani_private.paid_effects where operation_id=p_operation_id and effect_id=p_effect_id;
 if found then
  if effect.request_hash<>body_hash then raise exception using errcode='PT409',message='paid effect identity conflict';end if;
  return jsonb_build_object('kind','claimed','version',1,'dispatch',false,'operationId',p_operation_id,'effectId',p_effect_id,'componentKey',p_component_key,'executionDay',effect.execution_day,'executionMicroUsdCharged',0,'executionProviderCalls',0,'dispatchUntil',effect.dispatch_until);
 end if;
 if (select count(*) from luvani_private.paid_effects where operation_id=p_operation_id and component_key=p_component_key)>=(c->>'maxEffects')::integer then return jsonb_build_object('kind','refused','reason','effect-limit');end if;
 -- Re-read the server clock only after all context/operation lock waits. No
 -- client time or client day is admitted. Config mutex serializes first-day rows.
 stamp:=clock_timestamp();day_key:=(stamp at time zone 'UTC')::date;
 if cfg.expires_at<=stamp or (op.quote_definition->>'expiresAt')::timestamptz<=stamp then
  return jsonb_build_object('kind','refused','reason','admission-disabled');end if;
 until_at:=least((op.quote_definition->>'expiresAt')::timestamptz,cfg.expires_at,
   ((day_key+1)::timestamp at time zone 'UTC'));
 attempts:=p_max_provider_attempts;
 cost:=case when exists(select 1 from luvani_private.paid_component_days
   where operation_id=p_operation_id and component_key=p_component_key and day=day_key)
   then 0 else (c->>'microUsd')::bigint end;
 select * into gd from luvani_private.paid_execution_global_days where day=day_key for update;
 select * into ad from luvani_private.paid_execution_account_days where user_id=p_user_id and day=day_key for update;
 select * into vc from luvani_private.paid_admission_vendors where provider=c->>'provider';
 select * into vd from luvani_private.paid_execution_vendor_days where day=day_key and provider=c->>'provider' for update;
 if coalesce(gd.micro_usd,0)+cost>cfg.global_daily_micro_usd or coalesce(gd.calls,0)+attempts>cfg.global_daily_calls then
  return jsonb_build_object('kind','refused','reason','global-execution-budget');end if;
 if coalesce(ad.micro_usd,0)+cost>cfg.account_daily_micro_usd or coalesce(ad.calls,0)+attempts>cfg.account_daily_calls then
  return jsonb_build_object('kind','refused','reason','account-execution-budget');end if;
 if coalesce(vd.micro_usd,0)+cost>vc.daily_micro_usd or coalesce(vd.calls,0)+attempts>vc.daily_calls then
  return jsonb_build_object('kind','refused','reason','vendor-execution-budget');end if;
 -- Every refusal above precedes every execution ledger/effect write.
 insert into luvani_private.paid_execution_global_days(day,micro_usd,calls)values(day_key,cost,attempts)
  on conflict(day)do update set micro_usd=luvani_private.paid_execution_global_days.micro_usd+cost,calls=luvani_private.paid_execution_global_days.calls+attempts;
 insert into luvani_private.paid_execution_account_days(user_id,day,micro_usd,calls)values(p_user_id,day_key,cost,attempts)
  on conflict(user_id,day)do update set micro_usd=luvani_private.paid_execution_account_days.micro_usd+cost,calls=luvani_private.paid_execution_account_days.calls+attempts;
 insert into luvani_private.paid_execution_vendor_days(day,provider,micro_usd,calls)values(day_key,c->>'provider',cost,attempts)
  on conflict(day,provider)do update set micro_usd=luvani_private.paid_execution_vendor_days.micro_usd+cost,calls=luvani_private.paid_execution_vendor_days.calls+attempts;
 if cost>0 then insert into luvani_private.paid_component_days(operation_id,component_key,day,micro_usd)
  values(p_operation_id,p_component_key,day_key,cost);end if;
 insert into luvani_private.paid_effects(operation_id,effect_id,component_key,request_hash,execution_day,provider_calls,dispatch_until)
  values(p_operation_id,p_effect_id,p_component_key,body_hash,day_key,attempts,until_at);
 return jsonb_build_object('kind','claimed','version',1,'dispatch',true,'operationId',p_operation_id,'effectId',p_effect_id,'componentKey',p_component_key,
  'executionDay',day_key,'executionMicroUsdCharged',cost,'executionProviderCalls',attempts,'dispatchUntil',until_at);
end $$;
-- Protected API bridge: worker resumes ONLY its existing reservation after
-- authoritative tutor claim. No quote creation, expiry extension or nonce export.
create function public.resume_paid_tutor_v1(p_user_id uuid,p_session_id uuid,p_claim_nonce uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg luvani_private.paid_admission_config;op luvani_private.paid_operations;
 q luvani_private.paid_quotes;ctx jsonb;stamp timestamptz;
begin
 if p_user_id is null or p_session_id is null or p_claim_nonce is null then
  raise exception using errcode='PT400',message='invalid paid tutor resume';end if;
 perform 1 from auth.users where id=p_user_id for key share;
 if not found then return jsonb_build_object('kind','refused','reason','inactive-owner');end if;
 select * into cfg from luvani_private.paid_admission_config where singleton for update;
 ctx:=jsonb_build_object('kind','tutor','sessionId',p_session_id);
 select * into op from luvani_private.paid_operations where user_id=p_user_id and context=ctx
  and activity in ('lesson','lesson-text','convo','convo-text');
 if op.id is null then return jsonb_build_object('kind','refused','reason','not-reserved');end if;
 if not luvani_private.paid_context_active_v1(p_user_id,ctx||jsonb_build_object('claimNonce',p_claim_nonce),true,op.activity,op.quote_definition) then
  return jsonb_build_object('kind','refused','reason','inactive-context');end if;
 select * into op from luvani_private.paid_operations where id=op.id for update;
 stamp:=clock_timestamp();select * into q from luvani_private.paid_quotes where id=op.quote_id;
 if not cfg.enabled or cfg.expires_at is null or cfg.expires_at<=stamp or not coalesce(q.enabled,false)
  or (op.quote_definition->>'expiresAt')::timestamptz<=stamp then
  return jsonb_build_object('kind','refused','reason','admission-disabled');end if;
 return jsonb_build_object('kind','reserved','version',1,'operationId',op.id,'quoteId',op.quote_id,
  'configurationSha256',op.configuration_sha256,'activity',op.activity,'requestDigest',op.request_digest,
  'components',op.quote_definition->'components','expiresAt',op.quote_definition->>'expiresAt',
  'day',op.day,'microUsd',op.micro_usd,'providerCalls',op.calls,'replayed',true);
end $$;
create function public.paid_admission_schema_v1()returns jsonb
language sql security definer set search_path='' as $$
 select jsonb_build_object('version',1,'enabled',coalesce((select enabled and expires_at>clock_timestamp() from luvani_private.paid_admission_config where singleton),false),
  'executionDayBudget',true,'fencedTutorResume',true,'maxQuoteRevisions',4096,'maxComponents',16,'maxReservedProviderCalls',1024,'quantityUnits',array['inputBytes','outputTokens','audioMillis','textBytes'])
$$;
revoke execute on function public.reserve_paid_operation_v1(uuid,uuid,uuid,text,jsonb,text),
 public.claim_paid_effect_v1(uuid,uuid,uuid,text,text,jsonb,integer,jsonb),public.resume_paid_tutor_v1(uuid,uuid,uuid),public.paid_admission_schema_v1()from public,anon,authenticated;
grant execute on function public.reserve_paid_operation_v1(uuid,uuid,uuid,text,jsonb,text),
 public.claim_paid_effect_v1(uuid,uuid,uuid,text,text,jsonb,integer,jsonb),public.resume_paid_tutor_v1(uuid,uuid,uuid),public.paid_admission_schema_v1()to service_role;
revoke execute on function luvani_private.paid_review_v1(text,text,text,timestamptz),luvani_private.paid_config_review_v1(),
 luvani_private.paid_quote_valid_v1(jsonb),luvani_private.paid_quote_insert_lock_v1(),luvani_private.paid_quote_review_v1(),
 luvani_private.paid_context_shape_v1(jsonb,boolean,uuid),luvani_private.paid_context_active_v1(uuid,jsonb,boolean,text,jsonb)
 from public,anon,authenticated,service_role;

-- Keep the six-argument tutor admission contract and existing allowance economics.
create or replace function public.reserve_tutor_session_v1(p_user_id uuid,p_session_id uuid,p_room_name text,p_mode text,p_request_digest text,p_auth_session_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare e public.entitlements; g public.session_grants; cfg public.tutor_session_admission_config; v_now timestamptz;
  v_available integer; v_amount integer; v_day date; v_issued bigint; v_owner_day luvani_private.tutor_account_budget_days;
begin
  if p_user_id is null or p_session_id is null or p_auth_session_id is null or p_room_name is null or p_room_name !~ '^[a-zA-Z0-9_-]{1,128}$'
    or p_mode is null or p_mode not in ('lesson','lesson-text','convo','convo-text') or p_request_digest is null or p_request_digest !~ '^[a-f0-9]{64}$' then
    raise exception using errcode='PT400',message='invalid tutor reservation';
  end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then return pg_catalog.jsonb_build_object('kind','refused','reason','gone'); end if;
  -- All global admission serializes here; completion never takes this lock.
  select * into cfg from public.tutor_session_admission_config where singleton for update;
  if not found then return pg_catalog.jsonb_build_object('kind','refused','reason','admission-disabled'); end if;
  e:=luvani_private.tutor_entitlement_v1(p_user_id);
  if e.user_id is null then return pg_catalog.jsonb_build_object('kind','refused','reason','gone'); end if;
  if not public.active_tutor_identity_v1(p_user_id,p_auth_session_id) then return pg_catalog.jsonb_build_object('kind','refused','reason','inactive-identity'); end if;
  v_now:=pg_catalog.clock_timestamp();
  select * into g from public.session_grants where session_id=p_session_id for update;
  if found then
    if g.user_id<>p_user_id or g.lifecycle_version<>1 or g.room_name<>p_room_name or g.mode<>p_mode
      or g.request_digest<>p_request_digest or g.auth_session_id<>p_auth_session_id then
      raise exception using errcode='PT409',message='reservation identity conflicts';
    end if;
    if g.state<>'reserved' or g.join_deadline<=v_now or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan then
      return pg_catalog.jsonb_build_object('kind','refused','reason','session-not-reservable');
    end if;
    return pg_catalog.jsonb_build_object('kind','reserved','version',1,'userId',p_user_id,'sessionId',p_session_id,'roomName',g.room_name,'mode',g.mode,
      'plan',g.grant_plan,'usageEpoch',g.usage_epoch,'reservedSeconds',g.reserved_seconds,
      'secondsRemaining',greatest(0,luvani_private.tutor_cap_v1(e.plan)-e.seconds_used),'joinDeadline',g.join_deadline,'serverNow',v_now);
  end if;
  if exists(select 1 from public.session_usage where session_id=p_session_id) then
    raise exception using errcode='PT409',message='session completion proof already exists';
  end if;
  -- Safely retire only unclaimed, expired/stale reservations, never a worker.
  for g in select * from public.session_grants where user_id=p_user_id and lifecycle_version=1
    and state in ('reserved','cancel_requested') and claimed_at is null for update loop
    if g.join_deadline<=v_now or g.state='cancel_requested' or g.usage_epoch<>e.usage_epoch or g.grant_plan<>e.plan then
      perform luvani_private.tutor_finish_v1(p_user_id,g.session_id,'expired','reconciler',
        luvani_private.tutor_payload_v1(g.checkpoint_revision,0,0,null,null),null,false);
    end if;
  end loop;
  if exists(select 1 from public.session_grants where user_id=p_user_id and lifecycle_version=1 and state in ('reserved','active','cancel_requested')) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','session-active');
  end if;
  if not cfg.enabled or cfg.max_active_sessions=0 or cfg.max_daily_issued_seconds=0
    or cfg.max_account_daily_sessions=0 or cfg.max_account_daily_seconds=0 then
    return pg_catalog.jsonb_build_object('kind','refused','reason','admission-disabled');
  end if;
  if (select count(*) from public.session_grants where lifecycle_version=1 and state in ('reserved','active','cancel_requested'))>=cfg.max_active_sessions then
    return pg_catalog.jsonb_build_object('kind','refused','reason','capacity');
  end if;
  v_available:=greatest(0,luvani_private.tutor_cap_v1(e.plan)-e.seconds_used-coalesce((select sum(reserved_seconds) from public.session_grants
    where user_id=p_user_id and usage_epoch=e.usage_epoch and lifecycle_version=1 and state in ('reserved','active','cancel_requested')),0)::integer);
  if v_available<120 then return pg_catalog.jsonb_build_object('kind','refused','reason',case
    when e.lapsed_from_paid then 'subscription-lapsed' when v_available=0 then 'exhausted' else 'insufficient-for-session' end); end if;
  v_amount:=least(cfg.max_session_seconds,v_available);
  v_now:=pg_catalog.clock_timestamp(); -- UTC counter bucket after preceding lock waits.
  v_day:=(v_now at time zone 'UTC')::date;
  insert into public.tutor_session_budget_days(day) values(v_day) on conflict(day) do nothing;
  select issued_seconds into v_issued from public.tutor_session_budget_days where day=v_day for update;
  if v_issued+v_amount>cfg.max_daily_issued_seconds then return pg_catalog.jsonb_build_object('kind','refused','reason','daily-budget'); end if;
  select * into v_owner_day from luvani_private.tutor_account_budget_days where user_id=p_user_id and day=v_day for update;
  if coalesce(v_owner_day.issued_sessions,0)+1>cfg.max_account_daily_sessions
    or coalesce(v_owner_day.issued_seconds,0)+v_amount>cfg.max_account_daily_seconds then
    return pg_catalog.jsonb_build_object('kind','refused','reason','account-daily-budget'); end if;
  insert into public.session_grants(session_id,user_id,usage_epoch,lifecycle_version,state,auth_session_id,room_name,mode,request_digest,grant_plan,reserved_seconds,join_deadline,stop_grace_seconds)
    values(p_session_id,p_user_id,e.usage_epoch,1,'reserved',p_auth_session_id,p_room_name,p_mode,p_request_digest,e.plan,v_amount,
      v_now+pg_catalog.make_interval(secs=>cfg.join_ttl_seconds),cfg.stop_grace_seconds) returning * into g;
  update public.tutor_session_budget_days set issued_seconds=issued_seconds+v_amount where day=v_day;
  insert into luvani_private.tutor_account_budget_days(user_id,day,issued_sessions,issued_seconds) values(p_user_id,v_day,1,v_amount)
    on conflict(user_id,day) do update set issued_sessions=luvani_private.tutor_account_budget_days.issued_sessions+1,
      issued_seconds=luvani_private.tutor_account_budget_days.issued_seconds+v_amount;
  return pg_catalog.jsonb_build_object('kind','reserved','version',1,'userId',p_user_id,'sessionId',p_session_id,'roomName',g.room_name,'mode',g.mode,
    'plan',e.plan,'usageEpoch',e.usage_epoch,'reservedSeconds',v_amount,'secondsRemaining',v_available,'joinDeadline',g.join_deadline,'serverNow',v_now);
end $$;

commit;
