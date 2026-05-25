-- CreateEnum
CREATE TYPE "TenderDecision" AS ENUM ('UNDECIDED', 'REVIEW', 'BID', 'NO_BID');

-- AlterTable
ALTER TABLE "Tender"
ADD COLUMN "customerInn" TEXT,
ADD COLUMN "decision" "TenderDecision" NOT NULL DEFAULT 'UNDECIDED';

-- CreateIndex
CREATE INDEX "Tender_decision_idx" ON "Tender"("decision");
