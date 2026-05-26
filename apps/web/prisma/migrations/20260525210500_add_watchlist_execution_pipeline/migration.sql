-- SavedFilter execution metadata
CREATE TABLE "RuntimeLock" (
  "name" TEXT NOT NULL,
  "ownerToken" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RuntimeLock_pkey" PRIMARY KEY ("name")
);

CREATE INDEX "RuntimeLock_expiresAt_idx" ON "RuntimeLock"("expiresAt");

ALTER TABLE "SavedFilter"
ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "lastRunAt" TIMESTAMP(3),
ADD COLUMN "lastCursor" TEXT,
ADD COLUMN "lastResultCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX "SavedFilter_isActive_lastRunAt_idx" ON "SavedFilter"("isActive", "lastRunAt");

-- Tender source synchronization metadata
ALTER TABLE "Tender"
ADD COLUMN "sourceDedupeKey" TEXT,
ADD COLUMN "payloadHash" TEXT,
ADD COLUMN "updatedFromSourceAt" TIMESTAMP(3);

UPDATE "Tender"
SET "sourceDedupeKey" = 'owner:' || COALESCE("ownerId", 'unowned') ||
  ':external:' || "externalId" ||
  ':lot:' || COALESCE("lotNumber", '');

ALTER TABLE "Tender"
ALTER COLUMN "sourceDedupeKey" SET NOT NULL;

DROP INDEX IF EXISTS "Tender_sourceSystem_externalId_key";

CREATE UNIQUE INDEX "Tender_sourceDedupeKey_key" ON "Tender"("sourceDedupeKey");
CREATE INDEX "Tender_ownerId_externalId_lotNumber_idx" ON "Tender"("ownerId", "externalId", "lotNumber");

-- Document metadata dedupe for idempotent source runs
ALTER TABLE "Document"
ADD COLUMN "externalDocumentId" TEXT,
ADD COLUMN "dedupeKey" TEXT,
ADD COLUMN "sourceHash" TEXT;

UPDATE "Document"
SET "sourceHash" = "checksum",
    "dedupeKey" = CASE
      WHEN "checksum" IS NOT NULL AND "checksum" <> '' THEN 'hash:' || "checksum"
      WHEN "sourceUrl" IS NOT NULL AND "sourceUrl" <> '' THEN 'url:' || "sourceUrl"
      WHEN "title" IS NOT NULL AND "title" <> '' THEN 'title:' || md5(lower(trim("title")))
      ELSE 'legacy:' || "id"
    END;

ALTER TABLE "Document"
ALTER COLUMN "dedupeKey" SET NOT NULL;

CREATE UNIQUE INDEX "Document_tenderId_dedupeKey_key" ON "Document"("tenderId", "dedupeKey");
