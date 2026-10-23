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
-- storage objects. object_path names that file and must equal
-- <user_id>/<id>.wav for the row's own user id and clip id, so the uploader picks
-- the clip id (id stays insertable, defaulting to gen_random_uuid()) and names the
-- object before writing the row.
--
-- Shapes are closed so no free text can ride along: expected_phonemes is an array
-- of at most 200 JSON strings of 1..8 characters (4096 bytes); vendor_scores is an
-- array of at most 200 objects with exactly core's PhonemeObservation keys (ipa
-- 1..8 chars, score a number 0..100, word 1..40 chars, optional substituted 1..8
-- chars), 16384 bytes; reference_line is 1..200 characters, not blank, with no
-- control characters; lesson_id and turn_id are lowercase slugs.
--
-- Service-only, like saved_conversation_text: row level security is on, no policy
-- exists, and every privilege is revoked from public, anon, authenticated and
-- service_role (hosted defaults grant ALL), then service_role alone gets select,
-- delete and a column-level insert that excludes captured_at. There is no update
-- or truncate, so a clip's metadata never changes, and captured_at is always the
-- insert's now() (also checked to be no later than now() + 5 minutes). expires_at
-- must fall after capture and at most 24 months later, so retention is bounded by
-- the database. Both are indexed for the expiry, withdrawal and erasure sweeps.
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
  consent_version smallint not null
    constraint speech_dataset_clips_consent_version check (consent_version > 0),
  object_path text not null unique
    constraint speech_dataset_clips_object_path check (object_path = user_id::text || '/' || id::text || '.wav'),
  lesson_id text not null
    constraint speech_dataset_clips_lesson_id check (lesson_id ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  turn_id text not null
    constraint speech_dataset_clips_turn_id check (turn_id ~ '^[a-z0-9][a-z0-9_.:-]{0,79}$'),
  reference_line text not null
    constraint speech_dataset_clips_reference_line check (
      char_length(reference_line) between 1 and 200
      and reference_line ~ '\S'
      and reference_line !~ '[[:cntrl:]]'),
  expected_phonemes jsonb not null default '[]'::jsonb
    constraint speech_dataset_clips_phonemes_shape check (
      jsonb_typeof(expected_phonemes) = 'array'
      and jsonb_array_length(expected_phonemes) <= 200
      and octet_length(expected_phonemes::text) <= 4096
      and not jsonb_path_exists(expected_phonemes,
        'strict $[*] ? (!(@.type() == "string" && @ like_regex "^.{1,8}$"))')),
  vendor text not null
    constraint speech_dataset_clips_vendor check (vendor in ('speechace', 'toneperfect')),
  vendor_scores jsonb not null default '[]'::jsonb
    constraint speech_dataset_clips_scores_shape check (
      jsonb_typeof(vendor_scores) = 'array'
      and jsonb_array_length(vendor_scores) <= 200
      and octet_length(vendor_scores::text) <= 16384
      and not jsonb_path_exists(vendor_scores, 'strict $[*] ? (@.type() != "object")')
      and not jsonb_path_exists(vendor_scores,
        'strict $[*] ? (@.type() == "object").keyvalue() ? (@.key != "ipa" && @.key != "score" && @.key != "word" && @.key != "substituted")')
      and not jsonb_path_exists(vendor_scores,
        'lax $[*] ? (!(@.ipa.type() == "string" && @.ipa like_regex "^.{1,8}$" && @.word.type() == "string" && @.word like_regex "^.{1,40}$" && @.score.type() == "number" && @.score >= 0 && @.score <= 100 && (!exists(@.substituted) || (@.substituted.type() == "string" && @.substituted like_regex "^.{1,8}$"))))')),
  cefr_band text not null
    constraint speech_dataset_clips_cefr_band check (cefr_band in ('A0', 'A1', 'A2')),
  duration_ms integer not null
    constraint speech_dataset_clips_duration check (duration_ms between 1 and 30000),
  sample_rate_hz integer not null
    constraint speech_dataset_clips_sample_rate check (sample_rate_hz = 16000),
  captured_at timestamptz not null default now()
    constraint speech_dataset_clips_captured_at check (captured_at <= now() + interval '5 minutes'),
  expires_at timestamptz not null,
  constraint speech_dataset_clips_retention
    check (expires_at > captured_at and expires_at <= captured_at + interval '24 months')
);

create index if not exists speech_dataset_clips_user on public.speech_dataset_clips(user_id);
create index if not exists speech_dataset_clips_expiry on public.speech_dataset_clips(expires_at);

alter table public.speech_dataset_clips enable row level security;
revoke all on public.speech_dataset_clips from public, anon, authenticated, service_role;
grant select, delete on public.speech_dataset_clips to service_role;
grant insert (id, user_id, consent_version, object_path, lesson_id, turn_id, reference_line,
  expected_phonemes, vendor, vendor_scores, cefr_band, duration_ms, sample_rate_hz, expires_at)
  on public.speech_dataset_clips to service_role;

comment on table public.speech_dataset_clips is
  'Metadata only for consented speech-dataset clips: no audio, no transcript, no free text. Service-only. Inert until the legal review in docs/changes/speech-dataset.md.';

commit;
