CREATE TYPE "DocumentExtractionStatus" AS ENUM (
  'PENDING',
  'DOWNLOADED',
  'TEXT_READY',
  'OCR_REQUIRED',
  'FAILED'
);

ALTER TABLE "Document"
ADD COLUMN "extractionStatus" "DocumentExtractionStatus" NOT NULL DEFAULT 'PENDING',
ADD COLUMN "textContent" TEXT,
ADD COLUMN "textChecksum" TEXT,
ADD COLUMN "pageCount" INTEGER,
ADD COLUMN "hasTextLayer" BOOLEAN,
ADD COLUMN "extractionMetadata" JSONB;

CREATE INDEX "Document_extractionStatus_idx" ON "Document"("extractionStatus");
