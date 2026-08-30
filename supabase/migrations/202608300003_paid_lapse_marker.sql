-- F257 — remember that an exhausted trial came from a paid period.
--
-- F245 correctly collapses a paid row after its period ends, but plan='trial' by
-- itself cannot distinguish that learner from somebody whose introductory time
-- ended. The token server therefore used the only sentence it could justify and
-- told a former subscriber their free trial was finished.
--
-- Keep the marker beside entitlement state, not in a purchase record exposed to
-- clients. The trigger sees the transition atomically: paid -> trial sets it;
-- any verified projection back to a paid plan clears it. Direct service-role
-- writes and the consume RPC cross the same boundary.

alter table public.entitlements
add column if not exists lapsed_from_paid boolean not null default false;

create or replace function public.mark_paid_lapse()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.plan in ('starter', 'regular') and new.plan = 'trial' then
    new.lapsed_from_paid := true;
  elsif new.plan in ('starter', 'regular') then
    new.lapsed_from_paid := false;
  end if;
  return new;
end;
$$;

drop trigger if exists entitlements_mark_paid_lapse on public.entitlements;
create trigger entitlements_mark_paid_lapse
before update on public.entitlements
for each row execute function public.mark_paid_lapse();

revoke all on function public.mark_paid_lapse() from public, anon, authenticated;
grant execute on function public.mark_paid_lapse() to service_role;
