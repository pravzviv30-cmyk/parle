-- F970 (2026-11-10): the tutor baseline validator learns learnerReplies.
-- F904 (2026-10-28) added the optional learnerReplies count to ConversationPack
-- (packages/core conversationPacks.ts, replyCount: a safe integer, 0 or more), and
-- the tutor's checkpoint baseline carries it, so tutor_pack_v1 raised PT400
-- 'unknown tutor baseline field' at the first checkpoint after a learner reply and
-- every signed-in conversation ended. This adds 'learnerReplies' to the allow-list
-- and checks it is a JSON integer from 0 to 9007199254740991 (absent is fine).
-- Every other line is byte-for-byte 20261003231627. Create or replace only, no data
-- change, idempotent. CREATE OR REPLACE keeps owner and ACL; the revoke repeats
-- 20261003231627's for this function so a fresh replay ends the same.
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
    if k not in ('version','id','sessionId','learnerId','createdAt','lastPractisedAt','state','title','summary','learnerGoal','tutorGoal','cefr','durationSec','topics','keyPhrases','wins','corrections','pronunciationFocus','exercises','continuationSeed','revisedFromPackId','learnerReplies') then
      raise exception using errcode='PT400',message='unknown tutor baseline field';
    end if;
  end loop;
  if p_pack ? 'learnerReplies' and not (case when pg_catalog.jsonb_typeof(p_pack->'learnerReplies')='number' then
    (p_pack->'learnerReplies')::numeric between 0 and 9007199254740991
    and (p_pack->'learnerReplies')::numeric=pg_catalog.trunc((p_pack->'learnerReplies')::numeric) else false end) then
    raise exception using errcode='PT400',message='invalid tutor baseline';
  end if;
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
