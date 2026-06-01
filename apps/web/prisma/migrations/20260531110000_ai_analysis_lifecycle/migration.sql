CREATE TYPE "AIAnalysisKind" AS ENUM (
  'TENDER_SUMMARY',
  'DOCUMENT_SUMMARY'
);

ALTER TYPE "AIAnalysisStatus" RENAME TO "AIAnalysisStatus_old";

CREATE TYPE "AIAnalysisStatus" AS ENUM (
  'PENDING',
  'RUNNING',
  'COMPLETED',
  'FAILED'
);

ALTER TABLE "AIAnalysis"
ALTER COLUMN "status" DROP DEFAULT;

ALTER TABLE "AIAnalysis"
ALTER COLUMN "status" TYPE "AIAnalysisStatus"
USING (
  CASE "status"::text
    WHEN 'SUCCEEDED' THEN 'COMPLETED'
    WHEN 'SKIPPED' THEN 'FAILED'
    ELSE "status"::text
  END
)::"AIAnalysisStatus";

ALTER TABLE "AIAnalysis"
ALTER COLUMN "status" SET DEFAULT 'PENDING';

DROP TYPE "AIAnalysisStatus_old";

ALTER TABLE "AIAnalysis"
ADD COLUMN "documentId" TEXT,
ADD COLUMN "kind" "AIAnalysisKind" NOT NULL DEFAULT 'TENDER_SUMMARY',
ADD COLUMN "targetKey" TEXT,
ADD COLUMN "inputHash" TEXT,
ADD COLUMN "promptVersion" TEXT NOT NULL DEFAULT 'summary-v1',
ADD COLUMN "errorMessage" TEXT,
ADD COLUMN "startedAt" TIMESTAMP(3),
ADD COLUMN "completedAt" TIMESTAMP(3);

UPDATE "AIAnalysis"
SET
  "targetKey" = 'tender:' || "tenderId",
  "inputHash" = 'legacy:' || "id",
  "errorMessage" = COALESCE("errorMessage", "error")
WHERE "targetKey" IS NULL OR "inputHash" IS NULL OR "errorMessage" IS NULL;

ALTER TABLE "AIAnalysis"
ALTER COLUMN "targetKey" SET NOT NULL,
ALTER COLUMN "inputHash" SET NOT NULL;

CREATE INDEX "AIAnalysis_documentId_idx" ON "AIAnalysis"("documentId");
CREATE INDEX "AIAnalysis_kind_status_idx" ON "AIAnalysis"("kind", "status");
CREATE UNIQUE INDEX "AIAnalysis_targetKey_kind_inputHash_promptVersion_key"
ON "AIAnalysis"("targetKey", "kind", "inputHash", "promptVersion");

ALTER TABLE "AIAnalysis"
ADD CONSTRAINT "AIAnalysis_documentId_fkey"
FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE CASCADE ON UPDATE CASCADE;
