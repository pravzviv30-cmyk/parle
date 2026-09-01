-- Rollback for supabase/migrations/202608220001_luvani_learning.sql
--
-- DESTRUCTIVE. This drops every learner row Luvani owns: saved state, product events
-- and entitlements. Take the backup in supabase/README.md § Backup before you paste
-- it, and do not run it on a project that has real accounts without an escalation.
--
-- Run 202608230001_down.sql first if that migration has been applied: its objects
-- depend on these tables.
--
-- Idempotent and retryable: every statement is `if exists`, so a half-finished run can
-- be pasted again. Order is the reverse of creation, and each object the migration
-- created is named explicitly rather than left to a cascade, so the script doubles as
-- the inventory of what that migration owns.

-- function created by the migration
drop function if exists public.consume_entitlement(uuid, integer);

-- entitlements: policy, then table
drop policy if exists "learners read their own entitlement" on public.entitlements;
drop table if exists public.entitlements;

-- product_events: policy, index, then table
drop policy if exists "learners append their own events" on public.product_events;
drop index if exists public.product_events_user_time_idx;
drop table if exists public.product_events;

-- learner_state: four policies, then table
drop policy if exists "learners delete their own state" on public.learner_state;
drop policy if exists "learners update their own state" on public.learner_state;
drop policy if exists "learners insert their own state" on public.learner_state;
drop policy if exists "learners read their own state" on public.learner_state;
drop table if exists public.learner_state;

-- Nothing here touches auth.users. Accounts are Supabase's, not Luvani's, and a schema
-- rollback that deleted accounts would be a data-loss incident wearing a migration's
-- clothes.
