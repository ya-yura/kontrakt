import test from "node:test";
import assert from "node:assert/strict";
import { EIS223Adapter } from "../src/tenders/adapters/eis-223-adapter";

test("EIS223Adapter returns normalized fixture tenders", async () => {
  const adapter = new EIS223Adapter();
  const tenders = await adapter.listNormalizedTenders();

  assert.equal(tenders.length, 5);
  assert.equal(new Set(tenders.map((tender) => tender.customerInn)).size, 5);
  assert.equal(new Set(tenders.map((tender) => tender.maxPrice)).size, 5);
  assert.ok(tenders.every((tender) => tender.applicationStartAt));
  assert.ok(tenders.every((tender) => tender.participationRequirements.length > 0));
  assert.ok(tenders.every((tender) => tender.requiredDocuments.length > 0));
  assert.ok(tenders.every((tender) => tender.evaluationCriteria.length > 0));
  assert.ok(tenders.some((tender) => tender.documents.length >= 2));
  assert.ok(tenders.some((tender) => tender.changesFeed.length > 0));
});

test("EIS223Adapter isolates fixture documents from caller mutation", async () => {
  const adapter = new EIS223Adapter();
  const [firstRead] = await adapter.listNormalizedTenders();
  firstRead.documents.pop();

  const [secondRead] = await adapter.listNormalizedTenders();

  assert.equal(secondRead.documents.length, 3);
});
