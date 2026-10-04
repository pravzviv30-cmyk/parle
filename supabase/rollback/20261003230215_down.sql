-- SECURITY REGRESSION: removing admission restores unbounded direct writes.
-- Drain writers and restore a reviewed safer release before enabling this switch.
-- Retain quota counters + immutable receipt provenance with their closed ACLs;
-- do not erase operational history to make rollback/reapply appear clean.
-- Own the transaction so interlock errors cannot fall through to later DDL.
begin;
do $$begin
 if current_setting('luvani.rollback_data_bounds',true) is distinct from 'yes' then
  raise exception 'Refusing to remove data bounds. Drain writers, approve the security regression, then set luvani.rollback_data_bounds=yes explicitly.';
 end if;
end$$;
drop trigger if exists learner_state_owner_statement on public.learner_state;
drop trigger if exists product_events_owner_statement on public.product_events;
drop trigger if exists learner_state_admission on public.learner_state;
drop trigger if exists product_events_admission on public.product_events;
drop function if exists luvani_private.bound_learner_write_v1();
drop function if exists luvani_private.bound_product_event_v1();
drop function if exists luvani_private.lock_client_data_owner_v1();
drop function if exists luvani_private.check_learner_payload_v1(jsonb);
drop function if exists luvani_private.admit_data_write_v1(uuid,text);
drop index if exists public.product_events_received_at_idx;
-- received_at and luvani_private.data_write_quotas intentionally remain.
-- Reapplication fills only NULL receipts and preserves all prior quota history.
commit;
