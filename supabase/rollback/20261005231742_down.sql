-- REOPENS-F733: rolling this back means the next vendor read of a store trial
-- grants the whole monthly allowance, and a yearly product cannot be projected
-- at all by the six-argument function. Before running it, remove every
-- introductory offer and yearly product from App Store Connect and redeploy a
-- token server and maintenance worker that call apply_billing_projection with
-- six arguments. Rows already projected keep their plan, seconds and period
-- end (a yearly row keeps its paid year and the minutes of its current window);
-- only the record of when the next window is owed is dropped, and no allowance
-- is changed by this script.
do $$ begin
  if current_setting('luvani.reopen_trial_allowance', true) is distinct from 'yes' then
    raise exception 'refusing to remove the store trial and yearly allowance projection without explicit interlock';
  end if;
end $$;
drop function if exists public.billing_renewals_due_v1(integer);
drop index if exists public.entitlements_allowance_due;
drop function if exists public.apply_billing_projection_v2(uuid, bigint, text, text, timestamptz, text, integer, timestamptz);
drop trigger if exists entitlements_window_epoch on public.entitlements;
drop function if exists luvani_private.allowance_window_epoch_v1();
alter table public.entitlements drop constraint if exists entitlements_allowance_window_inside_period;
alter table public.entitlements drop column if exists allowance_window_end;
create or replace function public.billing_projection_version()
returns integer language sql security definer set search_path = '' as $$ select 1 $$;
revoke all on function public.billing_projection_version() from public, anon, authenticated;
grant execute on function public.billing_projection_version() to service_role;
notify pgrst, 'reload schema';
