-- SECURITY REGRESSION: restores the prior unbounded incoming request/expiry behavior.
-- Preserve every profile/relationship/block/report/challenge/notice/reaction row.
-- Drain social writers and approve the reopened admission risk before this switch.
-- Own the transaction so interlock errors cannot fall through to later DDL.
begin;
do $$begin
 if current_setting('luvani.rollback_social_bounds',true) is distinct from 'yes' then
  raise exception 'Refusing to remove social bounds. Drain writers and approve the security regression, then set luvani.rollback_social_bounds=yes explicitly.';
 end if;
end$$;
drop trigger if exists social_edges_incoming_admission on public.social_edges;
drop function if exists luvani_private.bound_incoming_request_v1();
drop index if exists public.social_blocks_target_idx;
drop index if exists public.social_reactions_user_idx;
drop index if exists public.social_reports_target_idx;
drop index if exists public.social_reports_user_idx;
drop index if exists public.social_edges_pending_sender_time_idx;
drop index if exists public.social_edges_pending_recipient_time_idx;
drop index if exists public.social_edges_pending_expiry_idx;

-- Restore the complete prior dispatcher, including its grants; never drop the
-- public invoker wrapper or remove social data. No expired rows are resurrected.
create or replace function luvani_private.social_dispatch(action text, args jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
 me uuid := auth.uid(); other uuid; edge_id uuid; chosen uuid; p public.social_profiles;
 start_week timestamptz := date_trunc('week',now() at time zone 'UTC') at time zone 'UTC';
 end_week timestamptz := (date_trunc('week',now() at time zone 'UTC') + interval '7 days') at time zone 'UTC';
 answer jsonb; stats jsonb; member record; challenge record; tally integer; key text;
begin
 if me is null or not exists(select 1 from auth.users where id=me) then raise exception 'not_allowed'; end if;
 if args is null or jsonb_typeof(args)<>'object' or octet_length(args::text)>4096 then raise exception 'not_allowed'; end if;
 -- Serialise all mutations by actor; pair-level uniqueness resolves cross-user races.
 perform pg_advisory_xact_lock(hashtext(me::text));
 select * into p from public.social_profiles where user_id=me;
 if action='enrol' then
  if coalesce(args->>'username','') !~ '^[a-z0-9][a-z0-9._]{2,23}$' then raise exception 'invalid_username'; end if;
  begin
   insert into public.social_profiles(user_id,username,display_name) values(me,args->>'username',left(coalesce(nullif(trim(args->>'name'),''),'Learner'),50))
   on conflict(user_id) do update set username=excluded.username,display_name=excluded.display_name,settings=public.social_profiles.settings||'{"enabled":true}'::jsonb;
  exception when unique_violation then raise exception 'username_taken'; end;
  return '{"ok":true}'::jsonb;
 end if;
 if action='snapshot' and (p.user_id is null or not coalesce((p.settings->>'enabled')::boolean,false)) then
  return jsonb_build_object('self',jsonb_build_object('id',me,'username',coalesce(p.username,''),'name',coalesce(p.display_name,'You'),'points',null,'days',0,'conversations',0),
   'friends','[]'::jsonb,'requests','[]'::jsonb,'challenges','[]'::jsonb,'notices','[]'::jsonb,'blocked','[]'::jsonb,
   'settings',coalesce(p.settings,'{"enabled":false,"showScore":true,"shareMilestones":false,"requests":true,"invitations":true,"completions":true,"milestones":false,"results":false}'::jsonb),'week',(start_week at time zone 'UTC')::date,'resets',end_week);
 end if;
 if p.user_id is null then raise exception 'not_allowed'; end if;
 if action='settings' then
  for key in select jsonb_object_keys(args) loop
   if key not in ('enabled','showScore','shareMilestones','requests','invitations','completions','milestones','results') or jsonb_typeof(args->key)<>'boolean' then raise exception 'not_allowed'; end if;
  end loop;
  update public.social_profiles set settings=settings||args where user_id=me;
  if args->>'enabled'='false' then
   delete from public.social_edges where sender=me or recipient=me;
   update public.social_challenges set status='left' where sender=me or recipient=me;
   delete from public.social_notices where user_id=me or actor=me;
  end if;
  if args->>'shareMilestones'='false' then delete from public.social_notices where actor=me and kind='milestone'; end if;
  return '{"ok":true}'::jsonb;
 end if;
 if not coalesce((p.settings->>'enabled')::boolean,false) then raise exception 'not_allowed'; end if;
 if action='search' then
  if length(coalesce(args->>'username',''))<3 then return '[]'::jsonb; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.user_id,'username',q.username,'name',q.display_name)),'[]') into answer
  from public.social_profiles q where q.username=lower(args->>'username') and q.user_id<>me and q.settings->>'enabled'='true'
   and not exists(select 1 from public.social_blocks b where (b.user_id=me and b.target=q.user_id) or (b.user_id=q.user_id and b.target=me));
  return answer;
 end if;
 if action='request' then
  select user_id into other from public.social_profiles q where q.username=lower(args->>'username') and q.settings->>'enabled'='true';
  if other is null or other=me or exists(select 1 from public.social_blocks where (user_id=me and target=other) or(user_id=other and target=me)) then raise exception 'not_found'; end if;
  perform pg_advisory_xact_lock(hashtext(least(me,other)::text||greatest(me,other)::text));
  -- Profile row locks also serialize leaving Friends against new invitations.
  perform 1 from public.social_profiles where user_id in (me,other) order by user_id for update;
  if not exists(select 1 from public.social_profiles where user_id=other and settings->>'enabled'='true') then raise exception 'not_found'; end if;
  if exists(select 1 from public.social_blocks where (user_id=me and target=other) or(user_id=other and target=me)) then raise exception 'not_found'; end if;
  if p.request_day=(now() at time zone 'UTC')::date and p.request_count>=20 then raise exception 'limit_reached'; end if;
  update public.social_profiles set request_count=case when request_day=(now() at time zone 'UTC')::date then request_count+1 else 1 end,request_day=(now() at time zone 'UTC')::date where user_id=me;
  if (select count(*) from public.social_edges where sender=me and status='pending')>=20 or (select count(*) from public.social_edges where sender=me or recipient=me)>=100 then raise exception 'limit_reached'; end if;
  insert into public.social_edges(sender,recipient) values(me,other) on conflict do nothing;
 elsif action in ('accept','decline','cancel','remove') then
  chosen := (args->>'id')::uuid;
  if action='remove' then other:=chosen;
  else select case when sender=me then recipient else sender end into other from public.social_edges where id=chosen and (sender=me or recipient=me); end if;
  if other is not null then
   perform pg_advisory_xact_lock(hashtext(least(me,other)::text||greatest(me,other)::text));
   perform 1 from public.social_profiles where user_id in (me,other) order by user_id for update;
  end if;
  if action='accept' then
   if (select count(*) from public.social_edges where (sender=me or recipient=me) and status='accepted')>=100 then raise exception 'limit_reached'; end if;
   update public.social_edges set status='accepted' where id=chosen and recipient=me and status='pending';
  elsif action='decline' then delete from public.social_edges where id=chosen and recipient=me and status='pending';
  elsif action='cancel' then delete from public.social_edges where id=chosen and sender=me and status='pending';
  else
   other:=chosen;
   delete from public.social_edges where (sender=me and recipient=other) or (recipient=me and sender=other);
   update public.social_challenges set status='left' where (sender=me and recipient=other) or (recipient=me and sender=other);
   delete from public.social_notices where (user_id=me and actor=other) or (user_id=other and actor=me);
  end if;
 elsif action in ('block','report','unblock') then
  other := (args->>'id')::uuid;
  if other=me then raise exception 'not_allowed'; end if;
  perform pg_advisory_xact_lock(hashtext(least(me,other)::text||greatest(me,other)::text));
  perform 1 from public.social_profiles where user_id in (me,other) order by user_id for update;
  if action='unblock' then delete from public.social_blocks where user_id=me and target=other;
  else
   if action='report' then
    if not exists(select 1 from public.social_edges where (sender=me and recipient=other) or(recipient=me and sender=other)) then raise exception 'not_allowed'; end if;
    if length(trim(coalesce(args->>'reason','')))=0 then raise exception 'not_allowed'; end if;
    insert into public.social_reports(user_id,target,reason) values(me,other,left(args->>'reason',500));
   end if;
   insert into public.social_blocks(user_id,target) values(me,other) on conflict do nothing;
   delete from public.social_edges where (sender=me and recipient=other) or (recipient=me and sender=other);
   update public.social_challenges set status='left' where (sender=me and recipient=other) or (recipient=me and sender=other);
   delete from public.social_notices where (user_id=me and actor=other) or (user_id=other and actor=me);
  end if;
 elsif action='inviteChallenge' then
  other:=(args->>'id')::uuid;
  -- Stable ordered pair lock also serialises simultaneous invitations from both ends.
  perform pg_advisory_xact_lock(hashtext(least(me,other)::text||greatest(me,other)::text));
  perform 1 from public.social_profiles where user_id in (me,other) order by user_id for update;
  if not exists(select 1 from public.social_edges where status='accepted' and ((sender=me and recipient=other) or(sender=other and recipient=me))) then raise exception 'not_allowed'; end if;
  if exists(select 1 from public.social_challenges where expires_at>now() and ((sender=me and recipient=other) or(sender=other and recipient=me))) then raise exception 'not_allowed'; end if;
  insert into public.social_challenges(sender,recipient,expires_at) values(me,other,end_week);
 elsif action in ('acceptChallenge','declineChallenge','leaveChallenge') then
  chosen:=(args->>'id')::uuid;
  if action='acceptChallenge' then
   update public.social_challenges set status='active',started_at=now() where id=chosen and recipient=me and status='pending' and expires_at>now();
  elsif action='declineChallenge' then update public.social_challenges set status='declined' where id=chosen and recipient=me and status='pending';
  else update public.social_challenges set status='left' where id=chosen and (sender=me or recipient=me) and expires_at>now(); end if;
 elsif action='react' then
  chosen:=(args->>'id')::uuid;
  select actor into other from public.social_notices where id=chosen and user_id=me and actor<>me;
  if other is not null then
   perform pg_advisory_xact_lock(hashtext(least(me,other)::text||greatest(me,other)::text));
   perform 1 from public.social_profiles where user_id in (me,other) order by user_id for update;
  end if;
  if other is null or not exists(select 1 from public.social_edges where status='accepted' and ((sender=me and recipient=other)or(sender=other and recipient=me))) then raise exception 'not_allowed'; end if;
  if args->>'reaction' not in ('Bravo!','Bien joué!','Nicely done') then raise exception 'not_allowed'; end if;
  insert into public.social_reactions(notice_id,user_id,reaction) values(chosen,me,args->>'reaction') on conflict(notice_id,user_id) do update set reaction=excluded.reaction;
  insert into public.social_notices(user_id,actor,kind,body,week,dedupe) values(other,me,'reaction',p.display_name||' says '||(args->>'reaction'),(start_week at time zone 'UTC')::date,'reaction:'||chosen||':'||me) on conflict(user_id,dedupe) do update set body=excluded.body;
 elsif action='read' then update public.social_notices set read=true where user_id=me;
 elsif action<>'snapshot' then raise exception 'not_allowed';
 end if;
 if action<>'snapshot' then return '{"ok":true}'::jsonb; end if;

 stats:=luvani_private.social_stats(me,start_week-interval '7 days',start_week);
 if (stats->>'days')::integer>0 then
  insert into public.social_notices(user_id,actor,kind,body,week,dedupe) values(me,me,'result',
   'Last week: '||(stats->>'days')||' active days and '||(stats->>'points')||' learning points. Your personal progress carries on.',
   ((start_week-interval '7 days') at time zone 'UTC')::date,'result:'||start_week) on conflict do nothing;
 end if;
 stats:=luvani_private.social_stats(me,start_week,end_week);
 answer:=jsonb_build_object('self',jsonb_build_object('id',me,'username',p.username,'name',p.display_name,'points',case when p.settings->>'showScore'='true' then stats->'points' else 'null'::jsonb end,'days',stats->'days','conversations',stats->'conversations'),'settings',p.settings,'week',(start_week at time zone 'UTC')::date,'resets',end_week);
 select coalesce(jsonb_agg(jsonb_build_object('id',q.user_id,'username',q.username,'name',q.display_name,'points',case when q.settings->>'showScore'='true' then s->'points' else 'null'::jsonb end,'days',case when q.settings->>'shareMilestones'='true' then s->'days' else '0'::jsonb end,'conversations',case when q.settings->>'shareMilestones'='true' then s->'conversations' else '0'::jsonb end)),'[]') into stats
 from public.social_edges e join public.social_profiles q on q.user_id=case when e.sender=me then e.recipient else e.sender end
 cross join lateral luvani_private.social_stats(q.user_id,start_week,end_week) s
 where (e.sender=me or e.recipient=me) and e.status='accepted' and q.settings->>'enabled'='true';
 answer:=answer||jsonb_build_object('friends',stats);
 select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'username',q.username,'name',q.display_name,'direction',case when e.recipient=me then 'incoming' else 'outgoing' end)),'[]') into stats
 from public.social_edges e join public.social_profiles q on q.user_id=case when e.sender=me then e.recipient else e.sender end
 where (e.sender=me or e.recipient=me) and e.status='pending';
 answer:=answer||jsonb_build_object('requests',stats);

 stats:='[]'::jsonb;
 for challenge in select c.*,q.display_name as partner from public.social_challenges c join public.social_profiles q on q.user_id=case when c.sender=me then c.recipient else c.sender end
 where (c.sender=me or c.recipient=me) and c.expires_at>now() and c.status in ('pending','active') loop
  tally:=0;
  if challenge.status='active' then
   tally:=least(4,(luvani_private.social_stats(challenge.sender,challenge.started_at,challenge.expires_at)->>'conversations')::integer+(luvani_private.social_stats(challenge.recipient,challenge.started_at,challenge.expires_at)->>'conversations')::integer);
  end if;
  stats:=stats||jsonb_build_array(jsonb_build_object('id',challenge.id,'partner',challenge.partner,'partnerId',case when challenge.sender=me then challenge.recipient else challenge.sender end,'status',challenge.status,'incoming',challenge.recipient=me,'count',tally,'target',4,'expires',challenge.expires_at));
  if tally>=4 then
   insert into public.social_notices(user_id,actor,kind,body,week,dedupe) values
   (challenge.sender,challenge.recipient,'completion','Your shared French postcard is ready. Four conversations, together.',(start_week at time zone 'UTC')::date,'challenge:'||challenge.id),
   (challenge.recipient,challenge.sender,'completion','Your shared French postcard is ready. Four conversations, together.',(start_week at time zone 'UTC')::date,'challenge:'||challenge.id) on conflict do nothing;
  end if;
 end loop;
 answer:=answer||jsonb_build_object('challenges',stats);
 -- Optional milestone sharing is checked at the time of read and withdrawal deletes old notices.
 for member in select q.user_id,q.display_name from public.social_edges e join public.social_profiles q on q.user_id=case when e.sender=me then e.recipient else e.sender end
 where (e.sender=me or e.recipient=me) and e.status='accepted' and q.settings->>'shareMilestones'='true' loop
  stats:=luvani_private.social_stats(member.user_id,start_week,end_week);
  if (stats->>'days')::integer>=3 then
   insert into public.social_notices(user_id,actor,kind,body,week,dedupe) values(me,member.user_id,'milestone',member.display_name||' made room for French on three days this week.',(start_week at time zone 'UTC')::date,'days:'||member.user_id||':'||start_week) on conflict do nothing;
  end if;
 end loop;
 select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'actor',q.display_name,'actorId',n.actor,'kind',n.kind,'body',n.body,'read',n.read,'week',n.week,'reactions',coalesce((select jsonb_agg(r.reaction) from public.social_reactions r where r.notice_id=n.id),'[]')) order by n.created_at desc),'[]') into stats
 from (select * from public.social_notices where user_id=me and created_at>now()-interval '30 days' order by created_at desc limit 40) n join public.social_profiles q on q.user_id=n.actor;
 answer:=answer||jsonb_build_object('notices',stats);
 select coalesce(jsonb_agg(jsonb_build_object('id',b.target,'name',q.display_name)),'[]') into stats from public.social_blocks b join public.social_profiles q on q.user_id=b.target where b.user_id=me;
 return answer||jsonb_build_object('blocked',stats);
end;
$$;
revoke all on function luvani_private.social_dispatch(text,jsonb) from public,anon;
grant execute on function luvani_private.social_dispatch(text,jsonb) to authenticated;
commit;
