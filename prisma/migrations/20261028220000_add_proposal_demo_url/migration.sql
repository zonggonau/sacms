-- Live demo website URL for a Proposal (e.g. a Vercel preview deployment
-- SaCMS's team already built for the prospect) — embedded as a QR code on
-- the generated proposal PDF so the prospect can scan and preview it live.

-- AlterTable
ALTER TABLE "proposals" ADD COLUMN "demoUrl" TEXT;
