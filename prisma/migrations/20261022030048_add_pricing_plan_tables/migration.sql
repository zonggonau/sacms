-- Platform-level pricing, moved out of CMS Content Entries (see the long
-- comment above these models in schema.prisma for why) into dedicated,
-- type-safe tables — one per kind of plan, since their real field sets are
-- mostly disjoint rather than variations of one shape.

-- CreateTable
CREATE TABLE "account_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "yearlyPrice" DOUBLE PRECISION,
    "maxWorkspaces" INTEGER NOT NULL,
    "features" JSONB,
    "isPopular" BOOLEAN NOT NULL DEFAULT false,
    "ctaText" TEXT,
    "ctaHref" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "account_plans_slug_key" ON "account_plans"("slug");

-- CreateTable
CREATE TABLE "workspace_plans" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" DOUBLE PRECISION NOT NULL,
    "yearlyPrice" DOUBLE PRECISION,
    "maxContentTypes" INTEGER NOT NULL,
    "maxContentEntries" INTEGER NOT NULL,
    "maxTeamMembers" INTEGER NOT NULL,
    "maxStorageMb" INTEGER NOT NULL,
    "maxLocales" INTEGER NOT NULL,
    "maxApiCalls" INTEGER NOT NULL,
    "fairUseBandwidthGb" INTEGER,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_plans_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_plans_slug_key" ON "workspace_plans"("slug");

-- CreateTable
CREATE TABLE "ai_credit_packs" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "credits" INTEGER NOT NULL,
    "priceUsd" DOUBLE PRECISION NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "badge" TEXT,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_credit_packs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_credit_packs_slug_key" ON "ai_credit_packs"("slug");

-- CreateTable
CREATE TABLE "addons" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "icon" TEXT,
    "price" DOUBLE PRECISION,
    "priceLabel" TEXT,
    "unit" TEXT,
    "featureKey" TEXT,
    "checkoutAlias" TEXT,
    "yearlyPrice" DOUBLE PRECISION,
    "isTopup" BOOLEAN NOT NULL DEFAULT false,
    "quotaType" TEXT,
    "amountUnits" BIGINT,
    "billingPeriod" TEXT,
    "features" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "addons_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "addons_slug_key" ON "addons"("slug");
