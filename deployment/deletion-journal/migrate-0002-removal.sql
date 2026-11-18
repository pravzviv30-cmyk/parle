-- Migration 0002: let a record be removed 37 days (JOURNAL_KEEP_DAYS) after its erasure is marked complete.
-- Run once against a journal created from the old schema.sql: README.md, "Migrate (founder)".
-- Order keeps the table guarded throughout: the new triggers exist before the old ones go.
-- Existing entries stay unstamped, so they are never removed (founder, 2026-11-18).
ALTER TABLE records ADD COLUMN completed_at TEXT;
CREATE TRIGGER records_completion_only BEFORE UPDATE ON records
WHEN NEW.rowid IS NOT OLD.rowid OR NEW.name IS NOT OLD.name OR NEW.body IS NOT OLD.body
  OR NEW.created_at IS NOT OLD.created_at OR NEW.completed_at IS NOT datetime('now')
BEGIN SELECT RAISE(ABORT, 'records change only by completion'); END;
CREATE TRIGGER records_delete_after_keep BEFORE DELETE ON records
WHEN OLD.completed_at IS NULL OR OLD.completed_at > datetime('now', '-37 days')
BEGIN SELECT RAISE(ABORT, 'record is inside its keep period'); END;
DROP TRIGGER records_no_update;
DROP TRIGGER records_no_delete;
