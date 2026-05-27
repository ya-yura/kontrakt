ALTER TABLE "KanbanStage" ADD COLUMN "checklistTemplate" JSONB;

ALTER TABLE "Tender"
ADD COLUMN "checklistState" JSONB,
ADD COLUMN "ownerComment" TEXT;
