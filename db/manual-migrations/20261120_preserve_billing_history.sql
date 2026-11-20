-- Preserve invoice and transaction relations when a workspace or account is removed.
ALTER TABLE "subscriptions"
  ADD COLUMN IF NOT EXISTS "billingInterval" TEXT,
  ADD COLUMN IF NOT EXISTS "recurringAmount" DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS "tenantNameSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "tenantSlugSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "userNameSnapshot" TEXT,
  ALTER COLUMN "userId" DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'subscriptions'::regclass AND conname = 'subscriptions_tenantId_fkey' AND confdeltype = 'n') THEN
    ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_tenantId_fkey";
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_tenantId_fkey"
      FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'subscriptions'::regclass AND conname = 'subscriptions_userId_fkey' AND confdeltype = 'n') THEN
    ALTER TABLE "subscriptions" DROP CONSTRAINT IF EXISTS "subscriptions_userId_fkey";
    ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$$;
