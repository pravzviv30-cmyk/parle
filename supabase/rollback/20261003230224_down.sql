-- Stops retention; it cannot resurrect erased analytics/expired anti-fraud markers.
-- Keep every grant, usage/refund/completion fence and review marker unchanged.
-- Stop the scheduler before rollback and review policy/backups before restoration.
-- Own the transaction so interlock errors cannot fall through to later DDL.
begin;
do $$begin
 if current_setting('luvani.rollback_data_retention',true) is distinct from 'yes' then
  raise exception 'Refusing to stop retention. Stop its scheduler and approve the policy impact, then set luvani.rollback_data_retention=yes explicitly.';
 end if;
end$$;
drop function if exists public.run_data_retention_v1(integer);
drop index if exists public.session_usage_retention_due_idx;
drop index if exists public.trial_installations_retention_due_idx;
-- session_usage.detail_retention_reviewed_at is retained, not silently erased.
commit;
