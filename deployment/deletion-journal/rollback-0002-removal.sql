-- Rollback of migration 0002. Revert the token-server change and redeploy the old Worker first (README.md),
-- or completion marks fail and erasures stall on storage-failed. The strict triggers return before the new ones go.
CREATE TRIGGER IF NOT EXISTS records_no_update BEFORE UPDATE ON records BEGIN SELECT RAISE(ABORT, 'records are append-only'); END;
CREATE TRIGGER IF NOT EXISTS records_no_delete BEFORE DELETE ON records BEGIN SELECT RAISE(ABORT, 'records are append-only'); END;
DROP TRIGGER records_completion_only;
DROP TRIGGER records_delete_after_keep;
ALTER TABLE records DROP COLUMN completed_at;
