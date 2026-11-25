ALTER TABLE "website_templates" ADD COLUMN "price" INTEGER;

CREATE TABLE "website_template_purchases" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "websiteTemplateId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "website_template_purchases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "website_template_purchases_orderId_key" ON "website_template_purchases"("orderId");
CREATE UNIQUE INDEX "website_template_purchases_tenantId_websiteTemplateId_key" ON "website_template_purchases"("tenantId", "websiteTemplateId");

ALTER TABLE "website_template_purchases" ADD CONSTRAINT "website_template_purchases_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "website_template_purchases" ADD CONSTRAINT "website_template_purchases_websiteTemplateId_fkey" FOREIGN KEY ("websiteTemplateId") REFERENCES "website_templates"("id") ON DELETE CASCADE ON UPDATE CASCADE;
