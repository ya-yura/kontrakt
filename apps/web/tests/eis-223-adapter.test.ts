import test from "node:test";
import assert from "node:assert/strict";
import { EIS223Adapter } from "../src/tenders/adapters/eis-223-adapter";
import {
  normalizedTenderDTOSchema,
  unknownNormalizedTenderDTOToPrismaInput,
  toPrismaDocumentType
} from "../src/tenders/normalized-tender-dto";

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

test("NormalizedTenderDTO validates and maps to Prisma-shaped input without DB writes", () => {
  const dto = normalizedTenderDTOSchema.parse({
    externalPurchaseId: "32413500001",
    registryNumber: "32413500001",
    purchaseNumber: "32413500001",
    lotNumber: "1",
    sourceHash: "hash-fixture",
    sourceUrl: "https://zakupki.gov.ru/223/32413500001",
    platformName: "РТС-тендер",
    title: "Поставка медицинских расходных материалов",
    subjectDescription: "Расходные материалы",
    methodName: "Запрос котировок в электронной форме",
    statusName: "APPLICATION_SUBMISSION",
    customer: {
      name: "АО \"Городская стоматология\"",
      inn: "7701234567",
      kpp: "770101001",
      address: null
    },
    price: {
      maxPrice: "1850000.00",
      priceFormula: null,
      currencyCode: "RUB"
    },
    security: {
      applicationSecurityAmount: "18500.00",
      contractSecurityAmount: "92500.00"
    },
    deadlines: {
      applicationStartAt: "2026-05-20T10:00:00+03:00",
      applicationDeadlineAt: "2026-06-03T10:00:00+03:00",
      clarificationDeadlineAt: null,
      resultAt: null,
      publishedAt: "2026-05-20T00:00:00",
      updatedFromSourceAt: null
    },
    delivery: {
      deliveryPlace: null,
      deliveryPeriodText: null
    },
    region: {
      regionCode: "77",
      regionName: "Москва"
    },
    okpd2Codes: ["32.50.11.000"],
    documents: [
      {
        externalDocumentId: "32413500001-docs",
        type: "DOCUMENTATION",
        title: "Закупочная документация",
        fileName: "docs.pdf",
        sourceUrl: "https://zakupki.gov.ru/223/docs.pdf",
        sourceHash: "document-hash",
        publishedAt: "2026-05-20T09:35:00+03:00"
      },
      {
        externalDocumentId: "32413500001-result",
        type: "RESULT",
        title: "Итоги закупки",
        fileName: null,
        sourceUrl: null,
        sourceHash: null,
        publishedAt: null
      }
    ],
    requirements: ["Отсутствие в реестре недобросовестных поставщиков"],
    criteria: ["Цена договора"],
    changesFeed: [],
    sourcePayload: null
  });

  const prismaInput = unknownNormalizedTenderDTOToPrismaInput(dto);

  assert.equal(prismaInput.tender.sourceSystem, "EIS");
  assert.equal(prismaInput.tender.externalId, "32413500001");
  assert.equal(prismaInput.tender.initialPrice, "1850000.00");
  assert.ok(prismaInput.tender.publishedAt instanceof Date);
  assert.equal("sourceStage" in prismaInput.tender, false);
  assert.deepEqual(
    prismaInput.documents.map((document) => [document.type, document.status, document.checksum]),
    [
      ["PROCUREMENT_DOCUMENTATION", "EXTERNAL_ONLY", "document-hash"],
      ["OTHER", "MISSING", null]
    ]
  );
});

test("NormalizedTenderDTO document types map to existing Prisma document enum values", () => {
  assert.equal(toPrismaDocumentType("NOTICE"), "NOTICE");
  assert.equal(toPrismaDocumentType("DOCUMENTATION"), "PROCUREMENT_DOCUMENTATION");
  assert.equal(toPrismaDocumentType("CONTRACT_DRAFT"), "DRAFT_CONTRACT");
  assert.equal(toPrismaDocumentType("CLARIFICATION"), "CLARIFICATION");
  assert.equal(toPrismaDocumentType("PROTOCOL"), "PROTOCOL");
  assert.equal(toPrismaDocumentType("CHANGE"), "OTHER");
  assert.equal(toPrismaDocumentType("RESULT"), "OTHER");
  assert.equal(toPrismaDocumentType("OTHER"), "OTHER");
});
