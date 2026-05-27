CREATE TYPE "AlertDeliveryType" AS ENUM (
  'NEW_MATCH',
  'DEADLINE_T48',
  'DEADLINE_T24',
  'DEADLINE_T2',
  'NEW_CHANGE',
  'NEW_CLARIFICATION',
  'STAGE_SLA_BREACH'
);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "AlertDelivery" WHERE "tenderId" IS NULL) THEN
    RAISE EXCEPTION 'AlertDelivery rows with NULL tenderId must be cleaned before alert engine migration';
  END IF;

  IF EXISTS (SELECT 1 FROM "AlertDelivery" WHERE "channel"::text = 'IN_APP') THEN
    RAISE EXCEPTION 'AlertDelivery rows with IN_APP channel must be cleaned before alert engine migration';
  END IF;
END $$;

ALTER TABLE "AlertDelivery" DROP CONSTRAINT "AlertDelivery_tenderId_fkey";

DROP INDEX "AlertDelivery_status_idx";
DROP INDEX "AlertDelivery_userId_channel_dedupeKey_key";

ALTER TABLE "AlertDelivery"
  RENAME COLUMN "dedupeKey" TO "idempotencyKey";

ALTER TABLE "AlertDelivery"
  RENAME COLUMN "error" TO "errorMessage";

UPDATE "AlertDelivery"
SET "payload" = '{}'::jsonb
WHERE "payload" IS NULL;

ALTER TABLE "AlertDelivery"
  ADD COLUMN "type" "AlertDeliveryType";

UPDATE "AlertDelivery"
SET "type" = 'NEW_MATCH'
WHERE "type" IS NULL;

ALTER TABLE "AlertDelivery"
  ADD COLUMN "acknowledgedAt" TIMESTAMP(3),
  ALTER COLUMN "tenderId" SET NOT NULL,
  ALTER COLUMN "payload" SET NOT NULL,
  ALTER COLUMN "type" SET NOT NULL,
  DROP COLUMN "status",
  DROP COLUMN "subject",
  DROP COLUMN "scheduledFor";

ALTER TYPE "AlertChannel" RENAME TO "AlertChannel_old";
CREATE TYPE "AlertChannel" AS ENUM ('EMAIL', 'TELEGRAM');

ALTER TABLE "AlertDelivery"
  ALTER COLUMN "channel" TYPE "AlertChannel"
  USING ("channel"::text::"AlertChannel");

DROP TYPE "AlertChannel_old";
DROP TYPE "AlertDeliveryStatus";

CREATE UNIQUE INDEX "AlertDelivery_idempotencyKey_key" ON "AlertDelivery"("idempotencyKey");
CREATE INDEX "AlertDelivery_userId_tenderId_idx" ON "AlertDelivery"("userId", "tenderId");
CREATE INDEX "AlertDelivery_type_idx" ON "AlertDelivery"("type");
CREATE INDEX "AlertDelivery_sentAt_idx" ON "AlertDelivery"("sentAt");

ALTER TABLE "AlertDelivery"
  ADD CONSTRAINT "AlertDelivery_tenderId_fkey"
  FOREIGN KEY ("tenderId") REFERENCES "Tender"("id") ON DELETE CASCADE ON UPDATE CASCADE;
