ALTER TABLE "User"
ADD COLUMN "companyProfile" JSONB,
ADD COLUMN "scoringPolicy" JSONB;

ALTER TABLE "Tender"
ADD COLUMN "decisionReason" TEXT,
ADD COLUMN "scoreTotal" INTEGER,
ADD COLUMN "scoreFit" INTEGER,
ADD COLUMN "scoreEconomics" INTEGER,
ADD COLUMN "scoreExecutionRisk" INTEGER,
ADD COLUMN "scoreComplianceRisk" INTEGER,
ADD COLUMN "scoreUrgency" INTEGER,
ADD COLUMN "scoreConfidence" INTEGER,
ADD COLUMN "scoreBreakdown" JSONB,
ADD COLUMN "lastScoredAt" TIMESTAMP(3);

CREATE INDEX "Tender_lastScoredAt_idx" ON "Tender"("lastScoredAt");
