-- Luvani deletion journal (Cloudflare D1). A record changes only by a completion stamped now, and is deleted only
-- 37 days (JOURNAL_KEEP_DAYS in store.ts) after it. Snapshots never change. A live journal gets here by migrate-0002-removal.sql.
CREATE TABLE IF NOT EXISTS records (
  rowid INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE CHECK (length(name) = 64),
  body TEXT NOT NULL CHECK (length(body) <= 2048),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS snapshots (
  id TEXT PRIMARY KEY,
  high_water INTEGER NOT NULL,
  total INTEGER NOT NULL,
  keys_sha256 TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TRIGGER records_completion_only BEFORE UPDATE ON records
WHEN NEW.rowid IS NOT OLD.rowid OR NEW.name IS NOT OLD.name OR NEW.body IS NOT OLD.body
  OR NEW.created_at IS NOT OLD.created_at OR NEW.completed_at IS NOT datetime('now')
BEGIN SELECT RAISE(ABORT, 'records change only by completion'); END;
CREATE TRIGGER records_delete_after_keep BEFORE DELETE ON records
WHEN OLD.completed_at IS NULL OR OLD.completed_at > datetime('now', '-37 days')
BEGIN SELECT RAISE(ABORT, 'record is inside its keep period'); END;
CREATE TRIGGER IF NOT EXISTS snapshots_no_update BEFORE UPDATE ON snapshots BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END;
CREATE TRIGGER IF NOT EXISTS snapshots_no_delete BEFORE DELETE ON snapshots BEGIN SELECT RAISE(ABORT, 'snapshots are immutable'); END;
