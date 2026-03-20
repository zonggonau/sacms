-- AlterTable
ALTER TABLE "content_entries" ADD COLUMN     "searchVector" tsvector;

-- Create GIN index for fast full-text search
CREATE INDEX "idx_content_search" ON "content_entries" USING GIN ("searchVector");

-- Auto-update search vector on INSERT or UPDATE
CREATE OR REPLACE FUNCTION update_search_vector() RETURNS trigger AS $$
BEGIN
  NEW."searchVector" := to_tsvector('english', coalesce(NEW.data, ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER content_search_update
  BEFORE INSERT OR UPDATE ON "content_entries"
  FOR EACH ROW EXECUTE FUNCTION update_search_vector();

-- Backfill existing entries
UPDATE "content_entries" SET "searchVector" = to_tsvector('english', coalesce(data, ''));
