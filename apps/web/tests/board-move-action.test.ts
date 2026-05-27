import test from "node:test";
import assert from "node:assert/strict";
import type { ChecklistState } from "../src/board/checklist";
import {
  moveTenderToStageForUser,
  type KanbanStageTargetRecord,
  type MoveTenderStageStore,
  type MovedTenderRecord,
  type TenderStageOwnerRecord
} from "../src/board/service";

type StoredTender = TenderStageOwnerRecord & {
  updateCount: number;
  checklistState?: ChecklistState | null;
};

class MemoryMoveTenderStageStore implements MoveTenderStageStore {
  readonly tenders = new Map<string, StoredTender>();
  readonly stages = new Map<string, KanbanStageTargetRecord>();
  lastUpdatedTenderId: string | null = null;
  lastUpdatedKanbanStageId: string | null = null;

  seedTender(record: Omit<StoredTender, "updateCount">) {
    this.tenders.set(record.id, {
      ...record,
      updateCount: 0
    });
  }

  seedStage(record: KanbanStageTargetRecord) {
    this.stages.set(`${record.ownerId}:${record.code}`, record);
  }

  async findOwnedTender(tenderId: string, userId: string): Promise<TenderStageOwnerRecord | null> {
    const tender = this.tenders.get(tenderId);

    if (!tender || tender.ownerId !== userId) {
      return null;
    }

    return tender;
  }

  async findOwnedStage(stageCode: string, userId: string): Promise<KanbanStageTargetRecord | null> {
    return this.stages.get(`${userId}:${stageCode}`) ?? null;
  }

  async updateTenderStage(tenderId: string, kanbanStageId: string): Promise<MovedTenderRecord> {
    const tender = this.tenders.get(tenderId);

    if (!tender) {
      throw new Error("Missing fake tender.");
    }

    tender.kanbanStageId = kanbanStageId;
    tender.updateCount += 1;
    this.lastUpdatedTenderId = tenderId;
    this.lastUpdatedKanbanStageId = kanbanStageId;

    return {
      id: tender.id,
      kanbanStageId: tender.kanbanStageId,
      sourceStage: tender.sourceStage
    };
  }
}

function createStore() {
  const store = new MemoryMoveTenderStageStore();
  store.seedStage({ id: "stage-inbox", ownerId: "user-1", code: "INBOX", name: "Inbox" });
  store.seedStage({
    id: "stage-go",
    ownerId: "user-1",
    code: "GO",
    name: "Go",
    checklistTemplate: {
      items: [
        { id: "go-confirm-decision", label: "Подтвердить решение" },
        { id: "go-assign-owner", label: "Назначить ответственного" }
      ]
    }
  });
  store.seedStage({ id: "stage-other-go", ownerId: "user-2", code: "GO", name: "Go" });
  store.seedTender({
    id: "tender-1",
    ownerId: "user-1",
    kanbanStageId: "stage-inbox",
    sourceStage: "SUBMISSION_OPEN"
  });

  return store;
}

test("moveTenderToStageForUser moves an owned tender to the target stage", async () => {
  const store = createStore();

  const result = await moveTenderToStageForUser(store, "user-1", {
    tenderId: "tender-1",
    stageCode: "GO"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected move action to succeed");
  }

  const tender = store.tenders.get("tender-1");
  assert.equal(tender?.kanbanStageId, "stage-go");
  assert.equal(tender?.updateCount, 1);
  assert.equal(result.data.stage.code, "GO");
  assert.equal(result.data.kanbanStageId, "stage-go");
});

test("moveTenderToStageForUser rejects tenders owned by another user", async () => {
  const store = createStore();
  store.seedTender({
    id: "tender-foreign",
    ownerId: "user-2",
    kanbanStageId: "stage-inbox",
    sourceStage: "COMMISSION_WORK"
  });

  const result = await moveTenderToStageForUser(store, "user-1", {
    tenderId: "tender-foreign",
    stageCode: "GO"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected foreign tender move to fail");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.tenders.get("tender-foreign")?.kanbanStageId, "stage-inbox");
  assert.equal(store.tenders.get("tender-foreign")?.updateCount, 0);
});

test("moveTenderToStageForUser rejects an invalid target stage", async () => {
  const store = createStore();

  const result = await moveTenderToStageForUser(store, "user-1", {
    tenderId: "tender-1",
    stageCode: "NOT_A_STAGE"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected invalid stage move to fail");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.tenders.get("tender-1")?.kanbanStageId, "stage-inbox");
  assert.equal(store.tenders.get("tender-1")?.updateCount, 0);
});

test("moveTenderToStageForUser rejects a stage owned by another user", async () => {
  const store = createStore();
  store.stages.delete("user-1:GO");

  const result = await moveTenderToStageForUser(store, "user-1", {
    tenderId: "tender-1",
    stageCode: "GO"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected foreign stage move to fail");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.tenders.get("tender-1")?.kanbanStageId, "stage-inbox");
  assert.equal(store.tenders.get("tender-1")?.updateCount, 0);
});

test("moveTenderToStageForUser does not change sourceStage", async () => {
  const store = createStore();

  const result = await moveTenderToStageForUser(store, "user-1", {
    tenderId: "tender-1",
    stageCode: "GO"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected move action to succeed");
  }

  assert.equal(store.tenders.get("tender-1")?.sourceStage, "SUBMISSION_OPEN");
  assert.equal(result.data.sourceStage, "SUBMISSION_OPEN");
  assert.equal(store.lastUpdatedTenderId, "tender-1");
  assert.equal(store.lastUpdatedKanbanStageId, "stage-go");
});

test("moveTenderToStageForUser keeps existing checklist state when stage changes", async () => {
  const store = createStore();
  const checklistState: ChecklistState = {
    items: {
      "inbox-relevance": {
        checked: true,
        updatedAt: "2026-05-26T06:00:00.000Z"
      }
    }
  };
  store.seedTender({
    id: "tender-with-checklist",
    ownerId: "user-1",
    kanbanStageId: "stage-inbox",
    sourceStage: "SUBMISSION_OPEN",
    checklistState
  });

  const result = await moveTenderToStageForUser(store, "user-1", {
    tenderId: "tender-with-checklist",
    stageCode: "GO"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected move action to succeed");
  }

  assert.deepEqual(store.tenders.get("tender-with-checklist")?.checklistState, checklistState);
  assert.equal(result.data.checklistProgress.total, 2);
  assert.equal(result.data.checklistProgress.checked, 0);
});
