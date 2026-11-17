-- Destructive rollback removes explicitly saved text. Export/backup before running.
do $$ begin
  if current_setting('luvani.remove_saved_text', true) is distinct from 'yes' then
    raise exception 'refusing to remove saved conversation text without explicit interlock';
  end if;
end $$;
drop function if exists public.export_account_data(uuid);
drop function if exists public.delete_conversation_text(uuid, uuid);
drop function if exists public.save_conversation_text(uuid, uuid, jsonb);
drop index if exists public.saved_conversation_text_owner_time;
drop table if exists public.saved_conversation_text;
