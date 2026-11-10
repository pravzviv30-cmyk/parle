-- Rollback for 20261110120000_tutor_pack_learner_replies.sql.
-- Restores luvani_private.tutor_pack_v1 exactly as 20261003231627 left it, so a
-- baseline carrying learnerReplies is refused again ('unknown tutor baseline field'),
-- which ends signed-in conversations at their first checkpoint (F970). Roll back
-- only together with an app and tutor that never send learnerReplies. No data
-- change. Safe to run twice.
begin;
create or replace function luvani_private.tutor_pack_v1(p_pack jsonb,p_user_id uuid,p_session_id uuid)
returns void language plpgsql set search_path='' as $$
declare k text; v jsonb;
begin
  if p_pack is null then return; end if;
  if pg_catalog.jsonb_typeof(p_pack) is distinct from 'object' or pg_catalog.octet_length(p_pack::text)>131072
    or p_pack->>'id' is distinct from p_session_id::text or p_pack->>'sessionId' is distinct from p_session_id::text
    or p_pack->>'learnerId' is distinct from p_user_id::text or p_pack->>'state' is distinct from 'ready'
    or p_pack->'version' is distinct from '1'::jsonb
    or pg_catalog.jsonb_typeof(p_pack->'title') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_pack->'title'->'fr') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'title'->'en') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'summary') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'continuationSeed') is distinct from 'object'
    or pg_catalog.jsonb_typeof(p_pack->'continuationSeed'->'titleFr') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'continuationSeed'->'titleEn') is distinct from 'string'
    or pg_catalog.jsonb_typeof(p_pack->'createdAt') is distinct from 'string' then
    raise exception using errcode='PT400',message='invalid tutor baseline';
  end if;
  perform (p_pack->>'createdAt')::timestamptz;
  for k in select pg_catalog.jsonb_object_keys(p_pack) loop
    if k not in ('version','id','sessionId','learnerId','createdAt','lastPractisedAt','state','title','summary','learnerGoal','tutorGoal','cefr','durationSec','topics','keyPhrases','wins','corrections','pronunciationFocus','exercises','continuationSeed','revisedFromPackId') then
      raise exception using errcode='PT400',message='unknown tutor baseline field';
    end if;
  end loop;
  for k,v in select * from pg_catalog.jsonb_each(p_pack) loop
    if k in ('keyPhrases','wins','corrections','exercises') and pg_catalog.jsonb_typeof(v) is distinct from 'array' then
      raise exception using errcode='PT400',message='invalid baseline array';
    end if;
  end loop;
  if pg_catalog.jsonb_typeof(p_pack->'keyPhrases') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'keyPhrases')>100
    or pg_catalog.jsonb_typeof(p_pack->'wins') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'wins')>100
    or pg_catalog.jsonb_typeof(p_pack->'corrections') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'corrections')>24
    or pg_catalog.jsonb_typeof(p_pack->'exercises') is distinct from 'array' or pg_catalog.jsonb_array_length(p_pack->'exercises')>24 then
    raise exception using errcode='PT400',message='baseline arrays exceed bound';
  end if;
  -- Recursive forbidden-key walk: curated pack only, no audio/transcript/history.
  if exists(with recursive nodes(v) as(
    select p_pack union all
    select child.v from nodes n cross join lateral(
      select e.value as v from pg_catalog.jsonb_each(case when pg_catalog.jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)e
      union all select a.value from pg_catalog.jsonb_array_elements(case when pg_catalog.jsonb_typeof(n.v)='array' then n.v else '[]'::jsonb end)a
    )child
  ) select 1 from nodes n cross join lateral pg_catalog.jsonb_object_keys(case when pg_catalog.jsonb_typeof(n.v)='object' then n.v else '{}'::jsonb end)key
    where pg_catalog.lower(key) in ('audio','rawaudio','recording','recordings','transcript','history','profile','memory')) then
    raise exception using errcode='PT400',message='private raw data is not a tutor baseline';
  end if;
end $$;
revoke all on function luvani_private.tutor_pack_v1(jsonb,uuid,uuid) from public,anon,authenticated,service_role;
commit;
