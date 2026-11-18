-- Beta metrics: read-only queries for the 100-learner beta (docs/changes/beta-launch.md).
--
-- Run in the Supabase SQL editor as the project owner. Every statement here
-- only reads. Nothing selects learner content: product events are counts and
-- closed choices by construction (PRIVACY_AND_SAFETY.md), session_usage holds
-- seconds, and the cohort join reads one closed goal answer from the synced
-- profile, never what anybody said. Query 2b reads practice dates and counts from
-- the synced activity and game namespaces, never a phrase. Queries 7 to 9 read
-- the plan, period and seconds columns of entitlements, never money.
--
-- Who is counted: queries 1 to 3, 2b and 7 to 9 cover every synced account in
-- aggregate. Product events exist only for learners who allowed analytics on
-- their phone, so queries 4 to 6 and 10 cover consented learners only, and the
-- database cannot say how many said no. Query 11 lists, as rows, what each
-- number can and cannot say, including month-one renewal, which this database
-- cannot measure because billing events carry no vendor event type (F1280).
--
-- Cohorts: 'deadline' = a trip, family, a move or work; 'hobby' = food or
-- learning for its own sake; 'unknown' = no synced answer, or a goal cleared in
-- Settings. The goal is onboardingGoal, which Settings edits, when the key is
-- present (null included), and the first onboarding answer, motivation, on older
-- profiles that only have that. A learner who edits their goal moves cohort for
-- all their history.
--
-- Cost per minute: the tutor agent prints one numbers-only [luvani:cost] line
-- per session (ttsCharsBilled, ttsCharsCached, ttsCharsReplayed, sttSec), keyed
-- by the same 8-hex session prefix as [luvani:brain:summary]. It lives in the
-- agent logs, not in this database; join it to session_usage seconds by hand.

-- 1. Who is in which cohort (one row per learner with a synced profile).
create temporary view beta_cohort as
select ls.user_id,
       case case when ls.payload #> '{data,onboardingGoal}' is not null
                 then ls.payload #>> '{data,onboardingGoal}'
                 else ls.payload #>> '{data,motivation}' end
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

-- 2b. D1 / D7 / D30 retention by practice day, by cohort, with the same columns
--    as query 2. A practice day is the product's own: a day in
--    activity.data.activeDays, the day of an activity entry that earned XP, or
--    the day of a finished game sitting (sittings hold only those that earned
--    none). Day 0 is a learner's first practice day, and of the learners whose
--    day 0 is at least N days ago, the share with a practice day on or after
--    day N. Offline practice counts once the phone has synced.
--
--    Honest limits:
--    - activeDays are the learner's local days, while entry and sitting times
--      are epoch milliseconds read as UTC days, so practice near midnight can
--      land a day off.
--    - Only synced accounts appear. Guests and phones that never synced are
--      absent. sittings keep the newest 500 and entries are pruned at 400
--      days, but activeDays is never pruned, so day 0 survives.
--    - Every path is checked for its type and every day key for a real date,
--      so a malformed payload adds no day instead of failing the report.
--    - A day after tomorrow (a phone clock set ahead) is dropped, so it cannot
--      read as a return. One day of slack is kept because local days can be
--      ahead of UTC.
with day_keys as (
  select ls.user_id,
         case when jsonb_typeof(d) = 'string' then d #>> '{}' end as day_key
  from public.learner_state ls
  cross join lateral jsonb_array_elements(case when jsonb_typeof(ls.payload #> '{data,activeDays}') = 'array'
    then ls.payload #> '{data,activeDays}' else '[]'::jsonb end) d
  where ls.namespace = 'activity'
  union all
  select ls.user_id,
         case when jsonb_typeof(e -> 'at') = 'number' and jsonb_typeof(e -> 'xp') = 'number' then
           case when (e ->> 'at')::numeric between 0 and 253402300799999 and (e ->> 'xp')::numeric > 0
             then to_char(to_timestamp((e ->> 'at')::numeric / 1000) at time zone 'UTC', 'YYYY-MM-DD') end end
  from public.learner_state ls
  cross join lateral jsonb_array_elements(case when jsonb_typeof(ls.payload #> '{data,entries}') = 'array'
    then ls.payload #> '{data,entries}' else '[]'::jsonb end) e
  where ls.namespace = 'activity'
  union all
  select ls.user_id,
         case when jsonb_typeof(s -> 'at') = 'number' then
           case when (s ->> 'at')::numeric between 0 and 253402300799999
             then to_char(to_timestamp((s ->> 'at')::numeric / 1000) at time zone 'UTC', 'YYYY-MM-DD') end end
  from public.learner_state ls
  cross join lateral jsonb_array_elements(case when jsonb_typeof(ls.payload #> '{data,sittings}') = 'array'
    then ls.payload #> '{data,sittings}' else '[]'::jsonb end) s
  where ls.namespace = 'game'
), dated as (
  select user_id, day_key,
         case when day_key ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
           then make_date(substr(day_key, 1, 4)::int, substr(day_key, 6, 2)::int, 1) + (substr(day_key, 9, 2)::int - 1) end as day
  from day_keys
), practice as (
  select distinct user_id, day from dated where to_char(day, 'YYYY-MM-DD') = day_key and day <= current_date + 1
), first_day as (
  select user_id, min(day) as day0 from practice group by user_id
), returned as (
  select f.user_id, f.day0,
    bool_or(p.day >= f.day0 + 1)  as d1,
    bool_or(p.day >= f.day0 + 7)  as d7,
    bool_or(p.day >= f.day0 + 30) as d30
  from first_day f join practice p using (user_id)
  group by f.user_id, f.day0
)
select coalesce(c.cohort, 'unknown') as cohort,
  count(*) filter (where r.day0 <= current_date - 1)  as eligible_d1,
  round(100.0 * count(*) filter (where r.d1 and r.day0 <= current_date - 1)
    / nullif(count(*) filter (where r.day0 <= current_date - 1), 0), 1) as d1_pct,
  count(*) filter (where r.day0 <= current_date - 7) as eligible_d7,
  round(100.0 * count(*) filter (where r.d7 and r.day0 <= current_date - 7)
    / nullif(count(*) filter (where r.day0 <= current_date - 7), 0), 1) as d7_pct,
  count(*) filter (where r.day0 <= current_date - 30) as eligible_d30,
  round(100.0 * count(*) filter (where r.d30 and r.day0 <= current_date - 30)
    / nullif(count(*) filter (where r.day0 <= current_date - 30), 0), 1) as d30_pct
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

-- 6. Time to first unaided French sentence, by cohort (the report's headline
--    number). For each learner with at least one finished live session, find
--    the first one with unassistedPct > 0 and turns >= 1, then report how many
--    finished sessions (lessons and conversations, 1-based) and how many billed
--    live minutes it took. Learners with sessions but no such session yet are
--    counted, not dropped, so a slow cohort cannot look fast by silence.
--
--    Billed minutes add every session_usage row with reported_at up to that
--    session's occurred_at plus 60 seconds. The tolerance is there because the
--    two writes race: on the authoritative path the agent settles the debit and
--    then publishes the recap the phone turns into the event, but the older
--    path publishes the recap first and debits after, so the usage row can land
--    a few seconds after the event. Sixty seconds covers that without reaching
--    the next session in the usual case; a learner who starts another session
--    inside it gets that session's minutes counted too, which only overstates.
--    Rows whose seconds were expired by the 24-month retention count as zero.
--
--    Honest limits:
--    - It is a proxy: at least one turn in a session with no rescue is
--      "unaided". It does not say the sentence was good, or French.
--    - It covers analytics-consented learners only, because the events exist
--      only for them; "no sessions" and "not consented" look the same here.
--      Learners with minutes but no event are absent.
--    - unassistedPct is rounded to a whole percent, so a session with one
--      unaided turn in 200 reads 1 and one in 300 reads 0 and is missed.
--    - Minutes are session length billed (seconds), not charged_seconds, so a
--      later refund does not reduce them. Same basis as query 3.
with finished as (
  select e.user_id, e.occurred_at,
         (e.properties->>'turns')::numeric as turns,
         (e.properties->>'unassistedPct')::numeric as unaided,
         row_number() over (partition by e.user_id order by e.occurred_at, e.id) as nth
  from public.product_events e
  where e.name = 'live_session_finished'
), first_unaided as (
  select distinct on (user_id) user_id, occurred_at, nth
  from finished
  where unaided > 0 and turns >= 1
  order by user_id, nth
), measured as (
  select f.user_id, f.nth as sessions,
         coalesce(sum(u.seconds), 0) / 60.0 as minutes
  from first_unaided f
  left join public.session_usage u
    on u.user_id = f.user_id and u.reported_at <= f.occurred_at + interval '60 seconds'
  group by f.user_id, f.nth
), learners as (
  select distinct user_id from finished
)
select coalesce(c.cohort, 'unknown') as cohort,
       count(m.user_id) as measured,
       count(*) filter (where m.user_id is null) as not_yet_unaided,
       round(percentile_cont(0.5) within group (order by m.minutes)::numeric, 1) as median_minutes,
       round(percentile_cont(0.75) within group (order by m.minutes)::numeric, 1) as p75_minutes,
       percentile_cont(0.5) within group (order by m.sessions) as median_sessions,
       percentile_cont(0.75) within group (order by m.sessions) as p75_sessions
from learners l
left join measured m using (user_id)
left join beta_cohort c using (user_id)
group by 1 order by 1;

-- 7. Where accounts stand today: one row per status, with its share of every
--    entitlements row. A live paid row is a Core or Max plan whose period ends
--    in the future. 'paying' withholds nothing, 'store trial' withholds part of
--    the allowance (the store's free trial), 'paid period ended, not yet lapsed'
--    is a paid row past its end that nothing has touched since, 'lapsed' is a
--    free row that was once on a paid plan, and 'free' is every other row.
--
--    Honest limits:
--    - A snapshot, not a rate: it says who is paying today, not what share of
--      store trials converted. There is no history of trial starts or of what
--      a period was, because billing events carry no vendor type (F1280).
--    - 'lapsed' is set the same way when a store trial expires as when a paid
--      period does, so it cannot tell the two apart.
--    - A weekly Starter product would also withhold. It is not configured.
select status, count(*) as accounts,
       round(100.0 * count(*) / sum(count(*)) over (), 1) as pct
from (
  select case
    when plan in ('starter', 'regular') and period_end > now() and withheld_seconds = 0 then 'paying'
    when plan in ('starter', 'regular') and period_end > now() then 'store trial'
    when plan in ('starter', 'regular') then 'paid period ended, not yet lapsed'
    when lapsed_from_paid then 'lapsed'
    else 'free' end as status
  from public.entitlements
) s
group by status order by status;

-- 8. Net price estimate over paying accounts (query 7's 'paying'): payers by
--    plan and period, and the estimated net dollars a month per payer, with a
--    year's price divided by 12. The last row is every payer together. A period
--    of 45 days or less is a month, a longer one a year, and a row with no
--    period start is 'unknown' and has no price.
--
--    Honest limits:
--    - An estimate, not money received. No price is stored in this database,
--      so the list below copies the US list prices and the Small Business store
--      fee from packages/core/src/metering/meter.ts, and the test pins it there.
--    - It ignores regional prices, tax, refunds, introductory offers and the
--      standard store fee that applies if the Small Business rate lapses.
with prices(plan, period, list_usd) as (values
  ('starter', 'month', 14.99), ('starter', 'year', 99), ('regular', 'month', 24.99), ('regular', 'year', 169)
), fee(rate) as (values (0.15)
), payers as (
  select e.plan,
         case when e.period_start is null then 'unknown'
              when e.period_end - e.period_start <= interval '45 days' then 'month' else 'year' end as period
  from public.entitlements e
  where e.plan in ('starter', 'regular') and e.period_end > now() and e.withheld_seconds = 0
)
select coalesce(p.plan, 'all payers') as plan, coalesce(p.period, 'all') as period,
       count(*) as payers,
       round(avg(pr.list_usd * (1 - f.rate) / case p.period when 'year' then 12 else 1 end), 2) as est_net_monthly_usd_per_payer
from payers p
left join prices pr on pr.plan = p.plan and pr.period = p.period
cross join fee f
group by grouping sets ((p.plan, p.period), ())
order by grouping(p.plan), 1, 2;

-- 9. Minutes used against the allowance, per plan and period, over live paid
--    rows (query 7's 'paying' and 'store trial'). Used is seconds_used less the
--    withheld part, and the allowance is the plan's cap, read from
--    luvani_private.tutor_cap_v1 like every debit, less the withheld part.
--    'trial' is a store trial. Otherwise a period of 45 days or less is a
--    month, a longer one a year, and 'unknown' has no period start. Days left
--    run to the end of the current allowance window, or of the period when the
--    row stores no window end, as a year's last window does. A window that has
--    ended and not been refilled yet has 0 days left.
--
--    Honest limits:
--    - A mid-window snapshot of the current window, so it reads lower than the
--      full-window use the margin model assumes. Past windows are not kept per
--      plan, so they are not here.
--    - Free accounts are not here: their allowance refills on its own schedule.
with live as (
  select e.plan,
         case when e.withheld_seconds > 0 then 'trial'
              when e.period_start is null then 'unknown'
              when e.period_end - e.period_start <= interval '45 days' then 'month' else 'year' end as period,
         (luvani_private.tutor_cap_v1(e.plan) - e.withheld_seconds) / 60.0 as allowance_minutes,
         greatest(e.seconds_used - e.withheld_seconds, 0) / 60.0 as used_minutes,
         greatest(extract(epoch from coalesce(e.allowance_window_end, e.period_end) - now()) / 86400, 0) as days_left
  from public.entitlements e
  where e.plan in ('starter', 'regular') and e.period_end > now()
)
select plan, period, count(*) as learners,
       round(avg(allowance_minutes), 1) as allowance_minutes,
       round(avg(used_minutes), 1) as avg_used_minutes,
       round(avg(100 * used_minutes / nullif(allowance_minutes, 0)), 1) as avg_used_pct,
       round((percentile_cont(0.5) within group (order by 100 * used_minutes / nullif(allowance_minutes, 0)))::numeric, 1) as median_used_pct,
       round(avg(days_left), 1) as avg_days_left
from live
group by plan, period order by plan, period;

-- 10. The subscription wall funnel by door (consented learners only). Each
--    wall_shown opens a showing that runs to the same learner's next
--    wall_shown, in occurred_at and id order, and every later wall event in
--    between belongs to it. Per door (wall_shown's entry): showings, learners,
--    and the showings that reached the plans page, selected a plan, started a
--    purchase, settled it 'done', and left with the plan 'granted'. 'refused'
--    is the free-limit door.
--
--    Honest limits:
--    - Events are sent without waiting, so one can land before the wall_shown
--      it followed and count toward the showing before it. Expect small leaks
--      between doors.
--    - A purchase settled 'done' is a store trial start or a payment. The
--      events do not tell the two apart.
--    - Learners who declined analytics are absent, and nothing here says how
--      many they are.
with wall as (
  select e.user_id, e.name, e.properties,
         count(*) filter (where e.name = 'wall_shown') over (partition by e.user_id order by e.occurred_at, e.id) as showing
  from public.product_events e
  where e.name in ('wall_shown', 'wall_page_seen', 'plan_selected', 'purchase_started', 'purchase_settled', 'wall_left')
), showings as (
  select user_id, showing,
         max(properties ->> 'entry') filter (where name = 'wall_shown') as entry,
         bool_or(name = 'wall_page_seen' and properties ->> 'page' = 'plans') as plans,
         bool_or(name = 'plan_selected') as selected,
         bool_or(name = 'purchase_started') as started,
         bool_or(name = 'purchase_settled' and properties ->> 'outcome' = 'done') as done,
         bool_or(name = 'wall_left' and properties ->> 'outcome' = 'granted') as granted
  from wall where showing > 0
  group by user_id, showing
)
select entry, count(*) as showings, count(distinct user_id) as learners,
       count(*) filter (where plans) as reached_plans,
       count(*) filter (where selected) as plan_selected,
       count(*) filter (where started) as purchase_started,
       count(*) filter (where done) as settled_done,
       count(*) filter (where granted) as left_granted
from showings
group by entry order by entry;

-- 11. The report index: one row per number, saying what it is, whom it covers
--    and what it cannot say. Comments do not show in the SQL editor's results,
--    so the gaps are here as rows.
select number, status, basis, gap
from (values
  (1, 'practice-day retention (2b)', 'measured', 'all synced learners',
   'Local activeDays beside UTC entry and sitting days, so a day can be off by one. Guests and unsynced phones are absent.'),
  (2, 'paid conversion (7)', 'snapshot', 'all accounts, billing tables',
   'Who is paying today, not what share of store trials converted. No trial start or trial-to-paid history is kept, and lapsed does not tell an expired trial from an expired payment.'),
  (3, 'net average price (8)', 'estimate', 'all accounts, billing tables',
   'US list price less the 15 percent Small Business fee, copied from core. Not money received: no regional prices, tax, refunds or offers.'),
  (4, 'month-one renewal by start week', 'not measurable', 'all accounts, billing tables',
   'No renewal is recorded. billing_events.event_type reads unknown on every row and nothing records a period kind (F1280). Read renewals in RevenueCat.'),
  (5, 'minutes used against the allowance (9)', 'snapshot', 'all accounts, billing tables',
   'The current window, mid-window, for live paid rows. Past windows are not kept per plan.'),
  (6, 'wall funnel by door (10)', 'measured', 'consented learners only',
   'A purchase settled done is a store trial start or a payment, not told apart. Learners who declined analytics are absent.')
) as report(n, number, status, basis, gap)
order by n;
