-- Sales pipeline: Penawaran (institutional proposals/offers) — tracks an
-- outbound offer to an outside institution through a fixed stage pipeline
-- (see PROPOSAL_STAGES in src/lib/proposal-stages.ts) up to a signed
-- cooperation contract (stage "won") or a lost deal (stage "lost").

-- CreateTable
CREATE TABLE "proposals" (
    "id" TEXT NOT NULL,
    "institutionName" TEXT NOT NULL,
    "institutionType" TEXT,
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "stage" TEXT NOT NULL DEFAULT 'draft',
    "estimatedValueIdr" INTEGER,
    "notes" TEXT,
    "lostReason" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proposal_activities" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "authorId" TEXT,
    "type" TEXT NOT NULL,
    "message" TEXT,
    "fromStage" TEXT,
    "toStage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_activities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "proposals_stage_idx" ON "proposals"("stage");

-- CreateIndex
CREATE INDEX "proposals_assignedToId_idx" ON "proposals"("assignedToId");

-- CreateIndex
CREATE INDEX "proposal_activities_proposalId_idx" ON "proposal_activities"("proposalId");

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposals" ADD CONSTRAINT "proposals_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_activities" ADD CONSTRAINT "proposal_activities_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proposal_activities" ADD CONSTRAINT "proposal_activities_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
