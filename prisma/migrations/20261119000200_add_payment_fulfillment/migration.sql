ALTER TABLE "payment_transactions" ADD COLUMN "fulfillmentStatus" TEXT;
CREATE INDEX "payment_transactions_status_fulfillmentStatus_idx" ON "payment_transactions"("status", "fulfillmentStatus");
