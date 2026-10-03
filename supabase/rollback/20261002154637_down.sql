-- REOPENS-F263/F264: disable all native purchase builds before rollback.
-- This removes completed-event metadata and ordering fences. It does not alter
-- any learner allowance, but old billing code is unsafe for a paid beta.
do $$ begin
  if current_setting('luvani.reopen_billing_projection', true) is distinct from 'yes' then
    raise exception 'refusing to remove atomic billing projection without explicit interlock';
  end if;
end $$;
drop function if exists public.apply_billing_projection(uuid, bigint, text, text, timestamptz, text);
drop function if exists public.begin_billing_refresh(uuid);
drop function if exists public.billing_projection_version();
alter table public.entitlements drop column if exists billing_applied_sequence;
alter table public.entitlements drop column if exists billing_sequence;
alter table public.billing_events drop column if exists processed_at;
notify pgrst, 'reload schema';
