ALTER TABLE "subscriptions"
  ADD COLUMN "billingInterval" TEXT,
  ADD COLUMN "recurringAmount" DOUBLE PRECISION,
  ADD COLUMN "tenantNameSnapshot" TEXT,
  ADD COLUMN "tenantSlugSnapshot" TEXT,
  ADD COLUMN "userNameSnapshot" TEXT,
  ALTER COLUMN "userId" DROP NOT NULL,
  DROP CONSTRAINT "subscriptions_tenantId_fkey",
  DROP CONSTRAINT "subscriptions_userId_fkey";

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "subscriptions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
