import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateChecklistProgress,
  type ChecklistState,
  type ChecklistTemplate
} from "../src/board/checklist";
import {
  updateTenderChecklistForUser,
  updateTenderOwnerCommentForUser,
  type TenderChecklistOwnerRecord,
  type TenderOwnerCommentOwnerRecord,
  type UpdateTenderChecklistStore,
  type UpdateTenderOwnerCommentStore
} from "../src/board/service";

type StoredTender = TenderChecklistOwnerRecord &
  TenderOwnerCommentOwnerRecord & {
    checklistState: ChecklistState | null;
    ownerComment: string | null;
    checklistUpdateCount: number;
    commentUpdateCount: number;
  };

class MemoryTenderWorkspaceStore
  implements UpdateTenderChecklistStore, UpdateTenderOwnerCommentStore
{
  readonly tenders = new Map<string, StoredTender>();

  seedTender(record: Omit<StoredTender, "checklistUpdateCount" | "commentUpdateCount">) {
    this.tenders.set(record.id, {
      ...record,
      checklistUpdateCount: 0,
      commentUpdateCount: 0
    });
  }

  async findOwnedTender(
    tenderId: string,
    userId: string
  ): Promise<TenderChecklistOwnerRecord | TenderOwnerCommentOwnerRecord | null> {
    const tender = this.tenders.get(tenderId);

    if (!tender || tender.ownerId !== userId) {
      return null;
    }

    return {
      id: tender.id,
      ownerId: tender.ownerId
    };
  }

  async updateTenderChecklist(tenderId: string, checklistState: ChecklistState) {
    const tender = this.tenders.get(tenderId);

    if (!tender) {
      throw new Error("Missing fake tender.");
    }

    tender.checklistState = checklistState;
    tender.checklistUpdateCount += 1;

    return {
      id: tender.id,
      checklistState
    };
  }

  async updateTenderOwnerComment(tenderId: string, ownerComment: string | null) {
    const tender = this.tenders.get(tenderId);

    if (!tender) {
      throw new Error("Missing fake tender.");
    }

    tender.ownerComment = ownerComment;
    tender.commentUpdateCount += 1;

    return {
      id: tender.id,
      ownerComment
    };
  }
}

function createStore() {
  const store = new MemoryTenderWorkspaceStore();
  store.seedTender({
    id: "tender-1",
    ownerId: "user-1",
    checklistState: null,
    ownerComment: null
  });

  return store;
}

test("updateTenderChecklistForUser rejects invalid checklist payload", async () => {
  const store = createStore();

  const result = await updateTenderChecklistForUser(store, "user-1", {
    tenderId: "tender-1",
    checklistState: {
      items: {
        "bad item id": {
          checked: "yes",
          updatedAt: "not-a-date"
        }
      }
    }
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected invalid checklist update to fail");
  }

  assert.equal(result.error.code, "VALIDATION_ERROR");
  assert.equal(store.tenders.get("tender-1")?.checklistUpdateCount, 0);
  assert.equal(store.tenders.get("tender-1")?.checklistState, null);
});

test("updateTenderChecklistForUser rejects tenders owned by another user", async () => {
  const store = createStore();
  store.seedTender({
    id: "foreign-tender",
    ownerId: "user-2",
    checklistState: null,
    ownerComment: null
  });

  const result = await updateTenderChecklistForUser(store, "user-1", {
    tenderId: "foreign-tender",
    checklistState: {
      items: {
        "inbox-relevance": {
          checked: true,
          updatedAt: "2026-05-26T06:00:00.000Z"
        }
      }
    }
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected foreign checklist update to fail");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.tenders.get("foreign-tender")?.checklistUpdateCount, 0);
});

test("calculateChecklistProgress counts only current template items", () => {
  const template: ChecklistTemplate = {
    items: [
      { id: "qualify-region", label: "Проверить регион" },
      { id: "qualify-price", label: "Проверить цену" },
      { id: "qualify-security", label: "Проверить обеспечение" }
    ]
  };
  const state: ChecklistState = {
    items: {
      "qualify-region": {
        checked: true,
        updatedAt: "2026-05-26T06:00:00.000Z"
      },
      "qualify-price": {
        checked: false,
        updatedAt: "2026-05-26T06:05:00.000Z"
      },
      "old-stage-item": {
        checked: true,
        updatedAt: "2026-05-26T06:10:00.000Z"
      }
    }
  };

  assert.deepEqual(calculateChecklistProgress(template, state), {
    checked: 1,
    total: 3,
    percent: 33
  });
});

test("updateTenderOwnerCommentForUser saves a normalized owner comment", async () => {
  const store = createStore();

  const result = await updateTenderOwnerCommentForUser(store, "user-1", {
    tenderId: "tender-1",
    ownerComment: "  Нужно проверить банковскую гарантию.  "
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected comment update to succeed");
  }

  assert.equal(result.data.ownerComment, "Нужно проверить банковскую гарантию.");
  assert.equal(store.tenders.get("tender-1")?.ownerComment, "Нужно проверить банковскую гарантию.");
  assert.equal(store.tenders.get("tender-1")?.commentUpdateCount, 1);
});
