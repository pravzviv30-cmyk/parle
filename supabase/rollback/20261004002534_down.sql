-- Export rollback is only safe before any artifact was ever issued. Once used,
-- drain clients/workers and repair forward; never delete an issued snapshot as
-- an accidental rollback side effect. Configuration defaults are OFF on reapply.
begin;
do $$ begin
  if pg_catalog.current_setting('luvani.rollback_account_exports',true) is distinct from 'on' then
    raise exception 'export rollback requires drained clients/workers and explicit interlock'; end if;
  if exists(select 1 from luvani_private.account_export_config where ever_issued)
    or exists(select 1 from luvani_private.account_exports) then
    raise exception 'export artifacts have been issued; use forward repair'; end if;
end $$;
drop function if exists public.cleanup_account_exports_v2(integer);
drop function if exists public.purge_account_export_v2(uuid,uuid);
drop function if exists public.account_export_part_v2(uuid,uuid,uuid,integer);
drop function if exists public.prepare_account_export_v2(uuid,uuid,uuid);
drop function if exists public.configure_account_export_v2(boolean,bigint,integer,bigint);
drop table if exists luvani_private.account_export_parts;
drop index if exists luvani_private.account_exports_expiry;
drop table if exists luvani_private.account_exports;
drop table if exists luvani_private.account_export_config;
commit;
