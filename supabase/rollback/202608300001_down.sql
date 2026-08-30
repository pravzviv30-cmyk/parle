-- Rollback for supabase/migrations/202608300001_billing_events.sql
--
-- DESTRUCTIVE. This drops the replay ledger and every row in it. Take the backup in
-- supabase/README.md § Backup first, and read the next paragraph before you paste it.
--
-- Stop the token server, or take /billing/webhook out of service, before running this.
-- The ledger is the only thing that makes a redelivered webhook a no-op, so without it
-- every billing event we have already acted on looks new again: the handler fetches the
-- subscriber a second time and reprojects an entitlement it has already projected. That
-- is money-shaped behaviour on a table drop, which is why it is written here rather than
-- left for somebody to discover.
--
-- What is lost is our copy, not the record. RevenueCat and Apple hold the financial
-- truth and hold it for years; this table holds only which of their deliveries we have
-- already answered. Re-applying the migration gives back an empty ledger, and the first
-- delivery of every event after that is treated as a first sighting.
--
-- Idempotent and retryable: every statement is `if exists`, so a half-finished run can be
-- pasted again. Order is the reverse of creation, and each object the migration created
-- is named explicitly rather than left to a cascade, so the script doubles as the
-- inventory of what that migration owns.

-- function created by the migration
drop function if exists public.record_billing_event(text, uuid);

-- billing_events: index, then table. There are no policies to drop: the migration
-- deliberately created none, which is what made the table private in the first place.
drop index if exists public.billing_events_user_time_idx;
drop table if exists public.billing_events;
