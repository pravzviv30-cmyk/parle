-- Disable both runtime switches and drain phrase synthesis first. Preserve spend
-- and period anchors; never enable generation after rollback with reset counters.
update public.phrase_audio_policy set enabled=false,
  trial_cap_micro_usd=0, paid_cap_micro_usd=0, global_cap_micro_usd=0 where singleton;
alter table public.phrase_audio_policy
  drop constraint if exists phrase_audio_approved_trial_cap,
  drop constraint if exists phrase_audio_approved_paid_cap,
  drop constraint if exists phrase_audio_approved_global_cap,
  alter column trial_cap_micro_usd set default 0,
  alter column paid_cap_micro_usd set default 0,
  alter column global_cap_micro_usd set default 0;
