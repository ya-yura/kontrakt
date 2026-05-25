-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('AVAILABLE', 'EXTERNAL_ONLY', 'MISSING');

-- AlterTable
ALTER TABLE "Tender"
ADD COLUMN "applicationStartAt" TIMESTAMP(3),
ADD COLUMN "clarificationDeadlineAt" TIMESTAMP(3),
ADD COLUMN "resultAt" TIMESTAMP(3),
ADD COLUMN "bidSecurityAmount" DECIMAL(18, 2),
ADD COLUMN "contractSecurityAmount" DECIMAL(18, 2),
ADD COLUMN "paymentTerms" TEXT,
ADD COLUMN "participationRequirements" JSONB,
ADD COLUMN "requiredDocuments" JSONB,
ADD COLUMN "evaluationCriteria" JSONB,
ADD COLUMN "changesFeed" JSONB;

-- AlterTable
ALTER TABLE "Document"
ADD COLUMN "fileName" TEXT,
ADD COLUMN "status" "DocumentStatus" NOT NULL DEFAULT 'AVAILABLE';
