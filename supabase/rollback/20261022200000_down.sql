-- Rollback for 20261022200000_speech_dataset_clips.sql. DESTRUCTIVE.
--
-- Drops public.speech_dataset_clips and every clip's metadata with it. If the
-- `speech-dataset` Storage bucket was ever created, empty its objects first, or the
-- audio files outlive the rows that name them and can no longer be swept by expiry
-- or withdrawal. Take the backup named in supabase/README.md first.
-- Refuses to run until luvani.remove_speech_clips is set to 'yes' in the same session.
--
-- Owns its transaction, so a refused interlock aborts the drops too, even under a
-- client that keeps going after an error. Safe to run twice.

begin;

do $$begin
  if current_setting('luvani.remove_speech_clips', true) is distinct from 'yes' then
    raise exception 'Refusing to drop speech dataset clips. Empty the speech-dataset bucket, take the backup, then set luvani.remove_speech_clips=yes explicitly.';
  end if;
end$$;

drop index if exists public.speech_dataset_clips_expiry;
drop index if exists public.speech_dataset_clips_user;
drop table if exists public.speech_dataset_clips;

commit;
