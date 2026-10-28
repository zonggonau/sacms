-- Staff-editable (optionally AI-suggested) feature list shown as the offer
-- item's description on the generated proposal PDF.

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN "featuresText" TEXT;
