-- Update source stage taxonomy to the Sprint 02 source-derived lifecycle.
ALTER TABLE "Tender" ALTER COLUMN "sourceStage" DROP DEFAULT;

CREATE TYPE "TenderSourceStage_new" AS ENUM (
  'UNKNOWN',
  'SUBMISSION_OPEN',
  'COMMISSION_WORK',
  'COMPLETED',
  'CANCELED',
  'EXPIRED'
);

ALTER TABLE "Tender"
ALTER COLUMN "sourceStage" TYPE "TenderSourceStage_new"
USING (
  CASE "sourceStage"::text
    WHEN 'APPLICATIONS_OPEN' THEN 'SUBMISSION_OPEN'
    WHEN 'PUBLISHED' THEN 'SUBMISSION_OPEN'
    WHEN 'APPLICATIONS_REVIEW' THEN 'COMMISSION_WORK'
    WHEN 'RESULTS_PUBLISHED' THEN 'COMPLETED'
    WHEN 'CONTRACTING' THEN 'COMPLETED'
    WHEN 'CANCELLED' THEN 'CANCELED'
    ELSE 'UNKNOWN'
  END
)::"TenderSourceStage_new";

ALTER TYPE "TenderSourceStage" RENAME TO "TenderSourceStage_old";
ALTER TYPE "TenderSourceStage_new" RENAME TO "TenderSourceStage";
DROP TYPE "TenderSourceStage_old";

ALTER TABLE "Tender" ALTER COLUMN "sourceStage" SET DEFAULT 'UNKNOWN';

ALTER TABLE "Tender"
ADD COLUMN "lastSeenAt" TIMESTAMP(3),
ADD COLUMN "providerMode" TEXT NOT NULL DEFAULT 'fixture';

UPDATE "Tender"
SET "lastSeenAt" = COALESCE("updatedFromSourceAt", "updatedAt")
WHERE "lastSeenAt" IS NULL;

CREATE INDEX "Tender_lastSeenAt_idx" ON "Tender"("lastSeenAt");
