-- speech_dataset_clips: metadata for a future consented, human-rated dataset of
-- English speakers saying known French reference lines, to calibrate
-- pronunciation scoring (docs/changes/speech-dataset.md).
--
-- INERT GROUNDWORK. Nothing writes here today, and PRIVACY_AND_SAFETY.md's promise
-- that live audio is never stored stays true. The table holds metadata only: no
-- audio, no transcript, no free text, no device id and no learning goal. The
-- reference line is curriculum text the learner was asked to say, never what they
-- said. Audio would live in a private Supabase Storage bucket (`speech-dataset`)
-- created at activation, after the legal review; this migration creates no
-- storage objects. object_path names that file as <user id>/<clip id>.wav, and
-- must sit under the row's own user id.
--
-- Service-only, like saved_conversation_text: row level security is on, every
-- client role is revoked and no policy exists, so anon and authenticated can
-- neither read nor write. Only service_role (which bypasses RLS) may select,
-- insert and delete; there is no update, so a clip's metadata never changes. Every
-- row carries expires_at, at most 24 months after capture, and is indexed for the
-- expiry sweep; the user_id index serves withdrawal and erasure sweeps.
--
-- Account deletion needs nothing new here: user_id references auth.users with on
-- delete cascade. The bucket objects must be removed by the same sweep.
--
-- Prepared and proved in disposable SQL (scripts/verifyDataBoundaries.mjs); not
-- applied live. Rollback: supabase/rollback/20261022200000_down.sql (DESTRUCTIVE).
begin;

create table if not exists public.speech_dataset_clips (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  consent_version smallint not null check (consent_version > 0),
  object_path text not null unique
    check (object_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.wav$'),
  lesson_id text not null check (lesson_id ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  turn_id text not null check (turn_id ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  reference_line text not null check (char_length(reference_line) between 1 and 200),
  expected_phonemes jsonb not null default '[]'::jsonb
    check (jsonb_typeof(expected_phonemes) = 'array' and jsonb_array_length(expected_phonemes) <= 200),
  vendor text not null check (vendor in ('speechace', 'toneperfect')),
  vendor_scores jsonb not null default '[]'::jsonb
    check (jsonb_typeof(vendor_scores) = 'array' and jsonb_array_length(vendor_scores) <= 200
      and octet_length(vendor_scores::text) <= 16384),
  cefr_band text not null check (cefr_band in ('A0', 'A1', 'A2')),
  duration_ms integer not null check (duration_ms between 1 and 30000),
  sample_rate_hz integer not null check (sample_rate_hz = 16000),
  captured_at timestamptz not null default now(),
  expires_at timestamptz not null,
  check (left(object_path, 37) = user_id::text || '/'),
  check (expires_at > captured_at and expires_at <= captured_at + interval '24 months')
);

create index if not exists speech_dataset_clips_user on public.speech_dataset_clips(user_id);
create index if not exists speech_dataset_clips_expiry on public.speech_dataset_clips(expires_at);

alter table public.speech_dataset_clips enable row level security;
revoke all on public.speech_dataset_clips from public, anon, authenticated;
grant select, insert, delete on public.speech_dataset_clips to service_role;

comment on table public.speech_dataset_clips is
  'Metadata only for consented speech-dataset clips: no audio, no transcript, no free text. Service-only. Inert until the legal review in docs/changes/speech-dataset.md.';

commit;
