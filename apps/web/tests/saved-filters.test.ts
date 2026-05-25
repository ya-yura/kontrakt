import test from "node:test";
import assert from "node:assert/strict";
import { savedFilterInputSchema } from "../src/saved-filters/schemas";
import {
  createSavedFilterForUser,
  deleteSavedFilterForUser,
  updateSavedFilterForUser,
  type SavedFilterCreateData,
  type SavedFilterOwnerRecord,
  type SavedFilterRecord,
  type SavedFilterStore,
  type SavedFilterWriteData
} from "../src/saved-filters/service";

class MemorySavedFilterStore implements SavedFilterStore {
  readonly records = new Map<string, SavedFilterRecord>();
  createdCount = 0;
  updatedCount = 0;
  deletedCount = 0;
  private nextId = 1;

  seed(record: SavedFilterRecord) {
    this.records.set(record.id, record);
  }

  async findById(filterId: string): Promise<SavedFilterOwnerRecord | null> {
    const record = this.records.get(filterId);

    if (!record) {
      return null;
    }

    return {
      id: record.id,
      userId: record.userId,
      name: record.name
    };
  }

  async findByUserAndName(userId: string, name: string): Promise<SavedFilterOwnerRecord | null> {
    for (const record of this.records.values()) {
      if (record.userId === userId && record.name === name) {
        return {
          id: record.id,
          userId: record.userId,
          name: record.name
        };
      }
    }

    return null;
  }

  async create(data: SavedFilterCreateData): Promise<SavedFilterRecord> {
    const record: SavedFilterRecord = {
      id: `filter-${this.nextId++}`,
      userId: data.userId,
      name: data.name,
      query: data.query,
      createdAt: new Date("2026-05-25T00:00:00.000Z"),
      updatedAt: new Date("2026-05-25T00:00:00.000Z")
    };

    this.createdCount += 1;
    this.records.set(record.id, record);
    return record;
  }

  async updateOwned(
    userId: string,
    filterId: string,
    data: SavedFilterWriteData
  ): Promise<SavedFilterRecord | null> {
    const record = this.records.get(filterId);

    if (!record || record.userId !== userId) {
      return null;
    }

    const updated: SavedFilterRecord = {
      ...record,
      name: data.name,
      query: data.query,
      updatedAt: new Date("2026-05-25T01:00:00.000Z")
    };

    this.updatedCount += 1;
    this.records.set(filterId, updated);
    return updated;
  }

  async deleteOwned(userId: string, filterId: string): Promise<boolean> {
    const record = this.records.get(filterId);

    if (!record || record.userId !== userId) {
      return false;
    }

    this.deletedCount += 1;
    this.records.delete(filterId);
    return true;
  }
}

function seedRecord(overrides: Partial<SavedFilterRecord>): SavedFilterRecord {
  return {
    id: "filter-existing",
    userId: "user-1",
    name: "Existing",
    query: savedFilterInputSchema.parse({ name: "Existing" }),
    createdAt: new Date("2026-05-25T00:00:00.000Z"),
    updatedAt: new Date("2026-05-25T00:00:00.000Z"),
    ...overrides
  };
}

test("saved filter schema normalizes user input", () => {
  const parsed = savedFilterInputSchema.parse({
    name: "  MSP tenders  ",
    includeKeywords: "clinic\nclinic, dental",
    minPrice: "100,50",
    maxPrice: "250",
    daysAhead: "14",
    onlyForMsp: "on"
  });

  assert.equal(parsed.name, "MSP tenders");
  assert.deepEqual(parsed.includeKeywords, ["clinic", "dental"]);
  assert.equal(parsed.minPrice, 100.5);
  assert.equal(parsed.maxPrice, 250);
  assert.equal(parsed.daysAhead, 14);
  assert.equal(parsed.onlyForMsp, true);
});

test("saved filter schema rejects inverted price range", () => {
  const result = savedFilterInputSchema.safeParse({
    name: "Bad budget",
    minPrice: 500,
    maxPrice: 100
  });

  assert.equal(result.success, false);
  if (result.success) {
    assert.fail("Expected schema validation to fail");
  }

  assert.equal(result.error.flatten().fieldErrors.maxPrice?.[0], "Максимальная цена должна быть не меньше минимальной");
});

test("createSavedFilterForUser returns duplicate name error for the same user", async () => {
  const store = new MemorySavedFilterStore();
  store.seed(seedRecord({ id: "filter-1", userId: "user-1", name: "Existing" }));

  const result = await createSavedFilterForUser(store, "user-1", {
    name: "Existing"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected duplicate name to fail");
  }

  assert.equal(result.error.code, "DUPLICATE_NAME");
  assert.equal(store.createdCount, 0);
});

test("updateSavedFilterForUser rejects filters owned by another user", async () => {
  const store = new MemorySavedFilterStore();
  store.seed(seedRecord({ id: "filter-1", userId: "user-2", name: "Other user filter" }));

  const result = await updateSavedFilterForUser(store, "user-1", {
    filterId: "filter-1",
    name: "Updated"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected ownership check to fail");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.updatedCount, 0);
});

test("updateSavedFilterForUser returns duplicate name when another owned filter has that name", async () => {
  const store = new MemorySavedFilterStore();
  store.seed(seedRecord({ id: "filter-1", userId: "user-1", name: "First" }));
  store.seed(seedRecord({ id: "filter-2", userId: "user-1", name: "Second" }));

  const result = await updateSavedFilterForUser(store, "user-1", {
    filterId: "filter-2",
    name: "First"
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected duplicate update name to fail");
  }

  assert.equal(result.error.code, "DUPLICATE_NAME");
  assert.equal(store.updatedCount, 0);
});

test("deleteSavedFilterForUser rejects filters owned by another user", async () => {
  const store = new MemorySavedFilterStore();
  store.seed(seedRecord({ id: "filter-1", userId: "user-2", name: "Other user filter" }));

  const result = await deleteSavedFilterForUser(store, "user-1", "filter-1");

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected ownership check to fail");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.deletedCount, 0);
  assert.equal(store.records.has("filter-1"), true);
});
