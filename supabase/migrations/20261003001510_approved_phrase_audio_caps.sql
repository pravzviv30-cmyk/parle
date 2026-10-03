-- Founder-approved maxima, 3 October 2026. Approval is not vendor-rate/playback
-- verification: keep policy disabled. Preserve every spend counter and anchor.
update public.phrase_audio_policy set enabled=false,
  trial_cap_micro_usd=20000, paid_cap_micro_usd=200000,
  global_cap_micro_usd=10000000 where singleton;

alter table public.phrase_audio_policy
  alter column trial_cap_micro_usd set default 20000,
  alter column paid_cap_micro_usd set default 200000,
  alter column global_cap_micro_usd set default 10000000,
  add constraint phrase_audio_approved_trial_cap check (trial_cap_micro_usd <= 20000),
  add constraint phrase_audio_approved_paid_cap check (paid_cap_micro_usd <= 200000),
  add constraint phrase_audio_approved_global_cap check (global_cap_micro_usd <= 10000000);
-- Existing non-negative checks, RLS/service-only access and atomic reservations
-- remain in force. No voice rates, switch enablement or spending reset here.
