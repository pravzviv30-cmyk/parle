-- Versioned immutable NDJSON export. OFF until hosted sizing and file delivery
-- are accepted. Limits are operational ceilings, not measured capacity claims.
begin;
create table luvani_private.account_export_config (
  singleton boolean primary key default true check(singleton),
  enabled boolean not null default false,
  ever_issued boolean not null default false,
  max_job_bytes bigint not null default 134217728 check(max_job_bytes between 65536 and 134217728),
  max_jobs integer not null default 100 check(max_jobs between 1 and 100),
  max_total_bytes bigint not null default 536870912 check(max_total_bytes between 65536 and 536870912),
  check(max_total_bytes>=max_job_bytes)
);
insert into luvani_private.account_export_config(singleton) values(true);
create table luvani_private.account_exports (
  export_id uuid primary key,
  user_id uuid not null unique references auth.users(id) on delete cascade,
  auth_session_id uuid not null,
  snapshot_at timestamptz not null,
  expires_at timestamptz not null,
  total_bytes bigint not null check(total_bytes between 1 and 134217728),
  total_parts integer not null check(total_parts between 1 and 2048),
  root_sha256 text check(root_sha256 ~ '^[a-f0-9]{64}$')
);
create index account_exports_expiry on luvani_private.account_exports(expires_at,export_id);
create table luvani_private.account_export_parts (
  export_id uuid not null references luvani_private.account_exports(export_id) on delete cascade,
  part integer not null check(part between 0 and 2047),
  data bytea not null check(octet_length(data) between 1 and 65536),
  sha256 text not null check(sha256 ~ '^[a-f0-9]{64}$'),
  primary key(export_id,part)
);
alter table luvani_private.account_export_config enable row level security;
alter table luvani_private.account_exports enable row level security;
alter table luvani_private.account_export_parts enable row level security;
revoke all on luvani_private.account_export_config,luvani_private.account_exports,luvani_private.account_export_parts from public,anon,authenticated,service_role;

create function public.configure_account_export_v2(p_enabled boolean,p_max_job_bytes bigint default 134217728,p_max_jobs integer default 100,p_max_total_bytes bigint default 536870912)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_enabled is null or p_max_job_bytes is null or p_max_jobs is null or p_max_total_bytes is null
    or p_max_job_bytes not between 65536 and 134217728 or p_max_jobs not between 1 and 100
    or p_max_total_bytes not between p_max_job_bytes and 536870912 then
    raise exception using errcode='PT400',message='invalid export capacity'; end if;
  update luvani_private.account_export_config set enabled=p_enabled,max_job_bytes=p_max_job_bytes,max_jobs=p_max_jobs,max_total_bytes=p_max_total_bytes where singleton;
  return pg_catalog.jsonb_build_object('version',2,'enabled',p_enabled,'maxJobBytes',p_max_job_bytes,'maxJobs',p_max_jobs,'maxTotalBytes',p_max_total_bytes);
end $$;

create function public.prepare_account_export_v2(p_user_id uuid,p_auth_session_id uuid,p_export_id uuid)
returns jsonb language plpgsql security definer set search_path='' set timezone='UTC' as $$
declare cfg luvani_private.account_export_config; job luvani_private.account_exports;
  stamp timestamptz; used_bytes bigint; used_jobs integer; measured_bytes bigint;
  chain bytea:=pg_catalog.sha256(''::bytea); part_row record;
begin
  if p_user_id is null or p_auth_session_id is null or p_export_id is null then
    raise exception using errcode='PT400',message='invalid export owner'; end if;
  -- Parent before configuration/child locks: auth deletion never inverts this.
  perform 1 from auth.users where id=p_user_id for key share;
  if not found then return pg_catalog.jsonb_build_object('kind','refused','reason','inactive-identity'); end if;
  select * into cfg from luvani_private.account_export_config where singleton for update;
  if not public.active_tutor_identity_v1(p_user_id,p_auth_session_id) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','inactive-identity'); end if;
  if not cfg.enabled then return pg_catalog.jsonb_build_object('kind','refused','reason','export-disabled'); end if;
  stamp:=pg_catalog.clock_timestamp();
  select * into job from luvani_private.account_exports where export_id=p_export_id for update;
  if found and (job.user_id<>p_user_id or job.auth_session_id<>p_auth_session_id) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','export-unavailable'); end if;
  if job.export_id is not null and job.expires_at>stamp then
    return pg_catalog.jsonb_build_object('kind','ready','version',2,'exportId',job.export_id,'snapshotAt',job.snapshot_at,
      'expiresAt',job.expires_at,'totalBytes',job.total_bytes,'totalParts',job.total_parts,
      'hashAlgorithm','sha256-chain-v1','rootSha256',job.root_sha256,'format','luvani-account-export-ndjson-v2'); end if;
  -- Only this owner's one expired artifact is deleted on prepare. Global expired
  -- data still consumes capacity until physically purged; it cannot grow forever.
  delete from luvani_private.account_exports where user_id=p_user_id and expires_at<=stamp;
  if exists(select 1 from luvani_private.account_exports where user_id=p_user_id) then
    return pg_catalog.jsonb_build_object('kind','refused','reason','export-active'); end if;
  select count(*)::integer,coalesce(sum(total_bytes),0) into used_jobs,used_bytes from luvani_private.account_exports;
  if used_jobs>=cfg.max_jobs then return pg_catalog.jsonb_build_object('kind','refused','reason','export-capacity'); end if;

  -- One SQL snapshot includes the explicit minimal Auth projection and all sixteen
  -- currently approved owned datasets. NOT MATERIALIZED avoids buffering an
  -- oversized source. The aggregate measures rows without making a whole-account
  -- JSON value; only an admitted source is partitioned into <=64KiB byte fragments.
  -- Account metadata is in this same command, not a separate GoTrue HTTP read.
  with source as not materialized (
    select 0 dataset_order,'manifest' dataset,'manifest' row_key,pg_catalog.jsonb_build_object(
      'kind','manifest','format','luvani-account-export-ndjson-v2','exportedAt',stamp,
      'account',pg_catalog.jsonb_build_object('id',u.id,'email',pg_catalog.to_jsonb(u)->>'email',
        'createdAt',pg_catalog.to_jsonb(u)->>'created_at','lastSignInAt',pg_catalog.to_jsonb(u)->>'last_sign_in_at'),
      'datasets',pg_catalog.jsonb_build_array('session_grants','learner_state','product_events','entitlements','session_usage','billing_events',
        'conversation_packs','saved_conversation_text','phrase_audio_budgets','social_profiles','social_blocks','social_reports',
        'social_notices','social_reactions','social_edges','social_challenges'),
      'notes',pg_catalog.jsonb_build_array('Raw learner audio is not stored. Saved text is opt-in; deleted text leaves a word-free retry marker.',
        'This version exports the sixteen named owned datasets and minimal account metadata. Private operational, antifraud and deletion evidence is excluded and described in the data inventory.')) doc
      from auth.users u where u.id=p_user_id
    union all select 1,'session_grants',r.session_id::text,pg_catalog.jsonb_build_object('kind','row','dataset','session_grants','row',pg_catalog.jsonb_build_object(
      'session_id',r.session_id,'user_id',r.user_id,'usage_epoch',r.usage_epoch,'created_at',r.created_at,
      'lifecycle_version',r.lifecycle_version,'state',r.state,'mode',r.mode,'grant_plan',r.grant_plan,
      'reserved_seconds',r.reserved_seconds,'join_deadline',r.join_deadline,'claimed_at',r.claimed_at,
      'hard_deadline',r.hard_deadline,'completion_receipt',r.completion_receipt,'terminal_reason',r.terminal_reason,'updated_at',r.updated_at,
      'details_expired_at',pg_catalog.to_jsonb(r)->'details_expired_at'))
      from public.session_grants r where r.user_id=p_user_id
    union all select 2,'learner_state',r.namespace,pg_catalog.jsonb_build_object('kind','row','dataset','learner_state','row',pg_catalog.to_jsonb(r)) from public.learner_state r where r.user_id=p_user_id
    union all select 3,'product_events',r.id::text,pg_catalog.jsonb_build_object('kind','row','dataset','product_events','row',pg_catalog.to_jsonb(r)) from public.product_events r where r.user_id=p_user_id
    union all select 4,'entitlements',r.user_id::text,pg_catalog.jsonb_build_object('kind','row','dataset','entitlements','row',pg_catalog.to_jsonb(r)) from public.entitlements r where r.user_id=p_user_id
    union all select 5,'session_usage',r.session_id::text,pg_catalog.jsonb_build_object('kind','row','dataset','session_usage','row',pg_catalog.to_jsonb(r)) from public.session_usage r where r.user_id=p_user_id
    union all select 6,'billing_events',r.event_id,pg_catalog.jsonb_build_object('kind','row','dataset','billing_events','row',pg_catalog.to_jsonb(r)) from public.billing_events r where r.user_id=p_user_id
    union all select 7,'conversation_packs',r.id::text,pg_catalog.jsonb_build_object('kind','row','dataset','conversation_packs','row',pg_catalog.to_jsonb(r)) from public.conversation_packs r where r.user_id=p_user_id
    union all select 8,'saved_conversation_text',r.session_id::text,pg_catalog.jsonb_build_object('kind','row','dataset','saved_conversation_text','row',pg_catalog.to_jsonb(r)) from public.saved_conversation_text r where r.user_id=p_user_id
    union all select 9,'phrase_audio_budgets',r.user_id::text,pg_catalog.jsonb_build_object('kind','row','dataset','phrase_audio_budgets','row',pg_catalog.to_jsonb(r)) from public.phrase_audio_budgets r where r.user_id=p_user_id
    union all select 10,'social_profiles',r.user_id::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_profiles','row',pg_catalog.to_jsonb(r)) from public.social_profiles r where r.user_id=p_user_id
    union all select 11,'social_blocks',pg_catalog.to_jsonb(r)::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_blocks','row',pg_catalog.to_jsonb(r)) from public.social_blocks r where r.user_id=p_user_id
    union all select 12,'social_reports',r.id::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_reports','row',pg_catalog.to_jsonb(r)) from public.social_reports r where r.user_id=p_user_id
    union all select 13,'social_notices',pg_catalog.to_jsonb(r)::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_notices','row',pg_catalog.to_jsonb(r)) from public.social_notices r where r.user_id=p_user_id
    union all select 14,'social_reactions',pg_catalog.to_jsonb(r)::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_reactions','row',pg_catalog.to_jsonb(r)) from public.social_reactions r where r.user_id=p_user_id
    union all select 15,'social_edges',r.id::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_edges','row',pg_catalog.to_jsonb(r)) from public.social_edges r where r.sender=p_user_id or r.recipient=p_user_id
    union all select 16,'social_challenges',r.id::text,pg_catalog.jsonb_build_object('kind','row','dataset','social_challenges','row',pg_catalog.to_jsonb(r)) from public.social_challenges r where r.sender=p_user_id or r.recipient=p_user_id
  ), measured as materialized (
    select coalesce(sum(pg_catalog.octet_length(pg_catalog.convert_to(doc::text||E'\n','UTF8'))),0)::bigint bytes from source
  ), admitted as (
    insert into luvani_private.account_exports(export_id,user_id,auth_session_id,snapshot_at,expires_at,total_bytes,total_parts)
    select p_export_id,p_user_id,p_auth_session_id,stamp,stamp+interval '15 minutes',bytes,((bytes+65535)/65536)::integer
      from measured where bytes between 1 and cfg.max_job_bytes and used_bytes+bytes<=cfg.max_total_bytes returning export_id
  ), records as (
    select dataset_order,row_key,pg_catalog.convert_to(doc::text||E'\n','UTF8') data from source cross join admitted
  ), positioned as (
    select data,pg_catalog.sum(pg_catalog.octet_length(data)) over(order by dataset_order,row_key rows unbounded preceding)-pg_catalog.octet_length(data) start_byte from records
  ), segments as (
    select n.part,positioned.start_byte,pg_catalog.substring(data,(greatest(n.part*65536,start_byte)-start_byte+1)::integer,
      (least((n.part+1)*65536,start_byte+pg_catalog.octet_length(data))-greatest(n.part*65536,start_byte))::integer) data
    from positioned cross join lateral pg_catalog.generate_series((start_byte/65536)::integer,
      ((start_byte+pg_catalog.octet_length(data)-1)/65536)::integer) n(part)
  ), fragments as (
    select part,pg_catalog.string_agg(data,''::bytea order by start_byte) data from segments group by part
  ), saved as (
    insert into luvani_private.account_export_parts(export_id,part,data,sha256)
    select p_export_id,part,data,pg_catalog.encode(pg_catalog.sha256(data),'hex') from fragments returning 1
  ) select bytes into measured_bytes from measured;
  select * into job from luvani_private.account_exports where export_id=p_export_id;
  if not found then return pg_catalog.jsonb_build_object('kind','refused','reason',case when measured_bytes>cfg.max_job_bytes then 'export-too-large' else 'export-capacity' end); end if;
  for part_row in select sha256 from luvani_private.account_export_parts where export_id=p_export_id order by part loop
    chain:=pg_catalog.sha256(chain||pg_catalog.decode(part_row.sha256,'hex'));
  end loop;
  update luvani_private.account_exports set root_sha256=pg_catalog.encode(chain,'hex') where export_id=p_export_id returning * into job;
  update luvani_private.account_export_config set ever_issued=true where singleton;
  return pg_catalog.jsonb_build_object('kind','ready','version',2,'exportId',job.export_id,'snapshotAt',job.snapshot_at,
    'expiresAt',job.expires_at,'totalBytes',job.total_bytes,'totalParts',job.total_parts,
    'hashAlgorithm','sha256-chain-v1','rootSha256',job.root_sha256,'format','luvani-account-export-ndjson-v2');
end $$;

create function public.account_export_part_v2(p_user_id uuid,p_auth_session_id uuid,p_export_id uuid,p_part integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare job luvani_private.account_exports; fragment luvani_private.account_export_parts;
begin
  if p_user_id is null or p_auth_session_id is null or p_export_id is null or p_part is null or p_part not between 0 and 2047 then
    raise exception using errcode='PT400',message='invalid export part'; end if;
  perform 1 from auth.users where id=p_user_id for key share;
  if not found or not public.active_tutor_identity_v1(p_user_id,p_auth_session_id) then return pg_catalog.jsonb_build_object('kind','unavailable'); end if;
  select * into job from luvani_private.account_exports where export_id=p_export_id and user_id=p_user_id and auth_session_id=p_auth_session_id for key share;
  if not found or job.expires_at<=pg_catalog.clock_timestamp() then return pg_catalog.jsonb_build_object('kind','unavailable'); end if;
  select * into fragment from luvani_private.account_export_parts where export_id=p_export_id and part=p_part;
  if not found then return pg_catalog.jsonb_build_object('kind','unavailable'); end if;
  return pg_catalog.jsonb_build_object('kind','part','version',2,'exportId',p_export_id,'part',p_part,'totalParts',job.total_parts,
    'bytes',pg_catalog.octet_length(fragment.data),'sha256',fragment.sha256,'dataBase64',pg_catalog.replace(pg_catalog.encode(fragment.data,'base64'),E'\n',''),
    'nextPart',case when p_part+1<job.total_parts then p_part+1 else null end);
end $$;

create function public.purge_account_export_v2(p_user_id uuid,p_export_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
begin
  if p_user_id is null or p_export_id is null then raise exception using errcode='PT400',message='invalid export owner'; end if;
  perform 1 from auth.users where id=p_user_id for key share;
  perform 1 from luvani_private.account_export_config where singleton for update;
  delete from luvani_private.account_exports where user_id=p_user_id and export_id=p_export_id;
  return pg_catalog.jsonb_build_object('kind','purged');
end $$;

create function public.cleanup_account_exports_v2(p_batch_size integer default 10)
returns jsonb language plpgsql security definer set search_path='' as $$
declare gone integer;
begin
  if p_batch_size is null or p_batch_size not between 1 and 100 then raise exception using errcode='PT400',message='invalid export cleanup batch'; end if;
  perform 1 from luvani_private.account_export_config where singleton for update;
  with expired as (select export_id from luvani_private.account_exports where expires_at<=pg_catalog.clock_timestamp()
    order by expires_at,export_id limit p_batch_size for update skip locked), removed as (
    delete from luvani_private.account_exports job using expired where job.export_id=expired.export_id returning 1
  ) select count(*)::integer into gone from removed;
  return pg_catalog.jsonb_build_object('kind','cleaned','jobsDeleted',gone,'limit',p_batch_size);
end $$;

revoke all on function public.configure_account_export_v2(boolean,bigint,integer,bigint),public.prepare_account_export_v2(uuid,uuid,uuid),
  public.account_export_part_v2(uuid,uuid,uuid,integer),public.purge_account_export_v2(uuid,uuid),public.cleanup_account_exports_v2(integer) from public,anon,authenticated;
grant execute on function public.configure_account_export_v2(boolean,bigint,integer,bigint),public.prepare_account_export_v2(uuid,uuid,uuid),
  public.account_export_part_v2(uuid,uuid,uuid,integer),public.purge_account_export_v2(uuid,uuid),public.cleanup_account_exports_v2(integer) to service_role;
commit;
