-- Scope Kanban stages to the same owner model used by Tender.ownerId.
ALTER TABLE "KanbanStage" ADD COLUMN "ownerId" TEXT;

DROP INDEX "KanbanStage_code_key";
DROP INDEX "KanbanStage_position_idx";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Tender" WHERE "ownerId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot scope KanbanStage ownership while ownerless Tender rows exist.';
  END IF;
END $$;

INSERT INTO "KanbanStage" (
  "id",
  "ownerId",
  "code",
  "name",
  "description",
  "position",
  "isDefault",
  "isTerminal",
  "createdAt",
  "updatedAt"
)
SELECT
  'stage_' || substr(md5("User"."id" || ':' || "KanbanStage"."code"), 1, 25),
  "User"."id",
  "KanbanStage"."code",
  "KanbanStage"."name",
  "KanbanStage"."description",
  "KanbanStage"."position",
  "KanbanStage"."isDefault",
  "KanbanStage"."isTerminal",
  "KanbanStage"."createdAt",
  NOW()
FROM "User"
CROSS JOIN "KanbanStage"
WHERE "KanbanStage"."ownerId" IS NULL;

UPDATE "Tender" AS tender
SET "kanbanStageId" = owned_stage."id"
FROM "KanbanStage" AS old_stage,
     "KanbanStage" AS owned_stage
WHERE tender."kanbanStageId" = old_stage."id"
  AND old_stage."ownerId" IS NULL
  AND owned_stage."ownerId" = tender."ownerId"
  AND owned_stage."code" = old_stage."code";

DELETE FROM "KanbanStage"
WHERE "ownerId" IS NULL;

ALTER TABLE "KanbanStage" ALTER COLUMN "ownerId" SET NOT NULL;

CREATE UNIQUE INDEX "KanbanStage_ownerId_code_key" ON "KanbanStage"("ownerId", "code");
CREATE UNIQUE INDEX "KanbanStage_ownerId_position_key" ON "KanbanStage"("ownerId", "position");

ALTER TABLE "KanbanStage" ADD CONSTRAINT "KanbanStage_ownerId_fkey"
FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
