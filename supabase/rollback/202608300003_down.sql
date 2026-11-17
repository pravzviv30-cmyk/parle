-- Rollback for 202608300003_paid_lapse_marker.sql.
-- Reopens F257: former subscribers are again indistinguishable from exhausted trials.

do $$ begin
  if current_setting('luvani.remove_lapse_marker', true) is distinct from 'yes' then
    raise exception 'refusing to remove the paid lapse marker without explicit interlock';
  end if;
end $$;
drop trigger if exists entitlements_mark_paid_lapse on public.entitlements;
drop function if exists public.mark_paid_lapse();
alter table public.entitlements drop column if exists lapsed_from_paid;
