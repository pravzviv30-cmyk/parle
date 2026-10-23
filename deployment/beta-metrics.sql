-- Beta metrics: read-only queries for the 100-learner beta (docs/changes/beta-launch.md).
--
-- Run in the Supabase SQL editor as the project owner. Every statement here
-- only reads. Nothing selects learner content: product events are counts and
-- closed choices by construction (PRIVACY_AND_SAFETY.md), session_usage holds
-- seconds, and the cohort join reads one closed onboarding answer from the
-- synced profile, never what anybody said.
--
-- Cohorts: 'deadline' = a trip, family, a move or work; 'hobby' = food or
-- learning for its own sake; 'unknown' = no synced answer.
--
-- Cost per minute: the tutor agent prints one numbers-only [luvani:cost] line
-- per session (ttsCharsBilled, ttsCharsCached, ttsCharsReplayed, sttSec), keyed
-- by the same 8-hex session prefix as [luvani:brain:summary]. It lives in the
-- agent logs, not in this database; join it to session_usage seconds by hand.

-- 1. Who is in which cohort (one row per learner with a synced profile).
create temporary view beta_cohort as
select ls.user_id,
       case ls.payload #>> '{data,motivation}'
         when 'trip' then 'deadline' when 'family' then 'deadline'
         when 'moving' then 'deadline' when 'work' then 'deadline'
         when 'food' then 'hobby' when 'because' then 'hobby'
         else 'unknown' end as cohort
from public.learner_state ls
where ls.namespace = 'profile';

-- 2. D1 / D7 / D30 retention by cohort: of the learners whose first live
--    session was at least N days ago, the share who had another session on or
--    after day N. Uses billed live sessions only.
with first_seen as (
  select user_id, min(reported_at) as first_at from public.session_usage group by user_id
), returned as (
  select f.user_id, f.first_at,
    bool_or(u.reported_at >= f.first_at + interval '1 day')  as d1,
    bool_or(u.reported_at >= f.first_at + interval '7 days') as d7,
    bool_or(u.reported_at >= f.first_at + interval '30 days') as d30
  from first_seen f join public.session_usage u using (user_id)
  group by f.user_id, f.first_at
)
select coalesce(c.cohort, 'unknown') as cohort,
  count(*) filter (where r.first_at <= now() - interval '1 day')  as eligible_d1,
  round(100.0 * count(*) filter (where r.d1 and r.first_at <= now() - interval '1 day')
    / nullif(count(*) filter (where r.first_at <= now() - interval '1 day'), 0), 1) as d1_pct,
  count(*) filter (where r.first_at <= now() - interval '7 days') as eligible_d7,
  round(100.0 * count(*) filter (where r.d7 and r.first_at <= now() - interval '7 days')
    / nullif(count(*) filter (where r.first_at <= now() - interval '7 days'), 0), 1) as d7_pct,
  count(*) filter (where r.first_at <= now() - interval '30 days') as eligible_d30,
  round(100.0 * count(*) filter (where r.d30 and r.first_at <= now() - interval '30 days')
    / nullif(count(*) filter (where r.first_at <= now() - interval '30 days'), 0), 1) as d30_pct
from returned r left join beta_cohort c using (user_id)
group by 1 order by 1;

-- 3. Live minutes per learner per week, by cohort.
select coalesce(c.cohort, 'unknown') as cohort,
       date_trunc('week', u.reported_at) as week,
       count(distinct u.user_id) as learners,
       round(sum(u.seconds) / 60.0 / nullif(count(distinct u.user_id), 0), 1) as minutes_per_learner
from public.session_usage u left join beta_cohort c using (user_id)
group by 1, 2 order by 2 desc, 1;

-- 4. How sessions go (consented learners only): turns, rescues, independence
--    and the phone-measured reply wait, by kind and voice.
select e.properties->>'kind' as kind,
       (e.properties->>'voice')::boolean as voice,
       count(*) as sessions,
       round(avg((e.properties->>'turns')::numeric), 1) as avg_turns,
       round(avg((e.properties->>'rescues')::numeric), 2) as avg_rescues,
       round(avg((e.properties->>'unassistedPct')::numeric), 1) as avg_unassisted_pct,
       percentile_cont(0.5) within group (order by (e.properties->>'replyLatencyMs')::numeric)
         filter (where e.properties->>'replyLatencyMs' is not null) as median_reply_ms
from public.product_events e
where e.name = 'live_session_finished'
group by 1, 2 order by 1, 2;

-- 5. Independence over a learner's first sessions: does the unaided share rise
--    from their 1st to their 5th finished conversation? (The product's own claim.)
with numbered as (
  select e.user_id, (e.properties->>'unassistedPct')::numeric as unaided,
         row_number() over (partition by e.user_id order by e.occurred_at) as nth
  from public.product_events e
  where e.name = 'live_session_finished' and e.properties->>'kind' = 'convo'
)
select nth, count(*) as learners, round(avg(unaided), 1) as avg_unassisted_pct
from numbered where nth <= 5 group by nth order by nth;
