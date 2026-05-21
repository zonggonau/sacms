-- ============================================================
-- Restore Full-Text Search GIN index + fix trigger
-- The previous migration (migrate_satu) accidentally dropped
-- the GIN index. This migration restores it and fixes the
-- trigger to correctly cast JSON data to text for tsvector.
-- ============================================================

-- Drop old trigger and function if they exist (to recreate cleanly)
DROP TRIGGER IF EXISTS content_search_update ON "content_entries";
DROP FUNCTION IF EXISTS update_search_vector();

-- Drop old index if somehow still present
DROP INDEX IF EXISTS "idx_content_search";

-- Recreate GIN index for fast full-text search
CREATE INDEX "idx_content_search" ON "content_entries" USING GIN ("searchVector");

-- Recreate auto-update trigger function
-- Uses data::text to cast JSONB to text for tsvector extraction
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW.data::text, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger that fires on every INSERT or UPDATE
CREATE TRIGGER content_search_update
  BEFORE INSERT OR UPDATE ON "content_entries"
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Backfill: update all existing entries' searchVector
UPDATE "content_entries"
SET "searchVector" = to_tsvector('english', coalesce(data::text, ''));
