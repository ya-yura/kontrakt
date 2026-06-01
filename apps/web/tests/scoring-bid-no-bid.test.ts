import test from "node:test";
import assert from "node:assert/strict";
import {
  decisionFromScore,
  rescoreTenderForUser,
  scoreTenderBidNoBid,
  setTenderDecisionForUser,
  type BidNoBidScore,
  type RescoreTenderStore,
  type SetTenderDecisionStore,
  type TenderDecisionOwnerRecord,
  type TenderDecisionValue,
  type TenderScoringOwnerRecord,
  type UpdatedTenderDecisionRecord
} from "../src/lib/scoring/bidNoBid";

const SCORED_AT = new Date("2026-05-26T09:00:00.000Z");

const baseCompanyProfile = {
  targetKeywords: ["стоматолог", "расходн", "медицин"],
  supportedRegions: ["Москва", "Санкт-Петербург"],
  availableLicenses: ["медицинские изделия"],
  availableCertificates: ["регистрационные удостоверения"],
  mandatoryExperienceAvailable: true,
  referencesAvailable: true
};

const baseScoringPolicy = {
  acceptedPurchaseMethods: ["электронной форме"],
  minPreparationDays: 3,
  maxBidSecurityAmount: 200000,
  maxContractSecurityAmount: 800000,
  maxTotalSecurityAmount: 900000,
  targetPriceMin: 1000000,
  targetPriceMax: 20000000,
  unacceptablePaymentTerms: ["отсрочка 90", "оплата после реализации"]
};

function createHighFitTender(
  overrides: Partial<TenderScoringOwnerRecord> = {}
): TenderScoringOwnerRecord {
  return {
    id: "tender-1",
    ownerId: "user-1",
    title: "Поставка стоматологических расходных материалов",
    description: "Медицинские изделия для сети клиник.",
    customerName: "АО Медицинские технологии",
    purchaseMethod: "Запрос котировок в электронной форме",
    initialPrice: "10000000.00",
    currency: "RUB",
    region: "Москва",
    publishedAt: "2026-05-20T09:00:00.000Z",
    submissionDeadline: "2026-06-10T09:00:00.000Z",
    bidSecurityAmount: "100000.00",
    contractSecurityAmount: "300000.00",
    paymentTerms: "30% аванс после подписания договора, остаток после приемки.",
    participationRequirements: [
      "Поставка медицинских изделий с регистрационными удостоверениями",
      "Подтвержденный опыт поставок расходных материалов"
    ],
    requiredDocuments: [
      "Коммерческое предложение",
      "Копии регистрационных удостоверений"
    ],
    evaluationCriteria: ["Цена", "Срок поставки"],
    sourceStage: "SUBMISSION_OPEN",
    documents: [
      { type: "NOTICE", title: "Извещение", status: "AVAILABLE" },
      {
        type: "PROCUREMENT_DOCUMENTATION",
        title: "Закупочная документация",
        status: "AVAILABLE"
      },
      { type: "TECHNICAL_SPECIFICATION", title: "Техническое задание", status: "AVAILABLE" }
    ],
    aiAnalyses: [{ status: "COMPLETED", score: 84, summary: "High fit" }],
    owner: {
      companyProfile: baseCompanyProfile,
      scoringPolicy: baseScoringPolicy
    },
    ...overrides
  };
}

test("decisionFromScore follows the threshold table", () => {
  assert.equal(decisionFromScore(70), "BID");
  assert.equal(decisionFromScore(69), "REVIEW");
  assert.equal(decisionFromScore(50), "REVIEW");
  assert.equal(decisionFromScore(49), "NO_BID");
});

test("hard blocker overrides a high score", () => {
  const score = scoreTenderBidNoBid(
    createHighFitTender({
      participationRequirements: ["Требуется лицензия ФСТЭК для исполнения договора"],
      owner: {
        companyProfile: {
          ...baseCompanyProfile,
          availableLicenses: []
        },
        scoringPolicy: baseScoringPolicy
      }
    }),
    {
      companyProfile: {
        ...baseCompanyProfile,
        availableLicenses: []
      },
      scoringPolicy: baseScoringPolicy
    },
    SCORED_AT
  );

  assert.ok(score.scoreTotal >= 70);
  assert.equal(score.decision, "NO_BID");
  assert.equal(score.scoreBreakdown.hardBlockers[0]?.code, "REQUIRED_LICENSE_UNAVAILABLE");
});

test("confidence below 60 prevents BID", () => {
  const tender = createHighFitTender({
    documents: [],
    aiAnalyses: []
  });
  const score = scoreTenderBidNoBid(
    tender,
    {
      companyProfile: baseCompanyProfile,
      scoringPolicy: baseScoringPolicy
    },
    SCORED_AT
  );

  assert.ok(score.scoreTotal >= 70);
  assert.ok(score.scoreConfidence < 60);
  assert.equal(score.scoreBreakdown.rawDecision, "BID");
  assert.equal(score.decision, "REVIEW");
});

test("unsupported region is a hard blocker", () => {
  const score = scoreTenderBidNoBid(
    createHighFitTender({
      region: "Казань"
    }),
    {
      companyProfile: baseCompanyProfile,
      scoringPolicy: baseScoringPolicy
    },
    SCORED_AT
  );

  assert.equal(score.decision, "NO_BID");
  assert.ok(
    score.scoreBreakdown.hardBlockers.some((blocker) => blocker.code === "UNSUPPORTED_REGION")
  );
});

test("security above limit is a hard blocker", () => {
  const score = scoreTenderBidNoBid(
    createHighFitTender(),
    {
      companyProfile: baseCompanyProfile,
      scoringPolicy: {
        ...baseScoringPolicy,
        maxBidSecurityAmount: 50000
      }
    },
    SCORED_AT
  );

  assert.equal(score.decision, "NO_BID");
  assert.ok(
    score.scoreBreakdown.hardBlockers.some((blocker) => blocker.code === "SECURITY_ABOVE_LIMIT")
  );
});

class MemoryDecisionStore implements SetTenderDecisionStore {
  readonly tenders = new Map<string, TenderDecisionOwnerRecord & { updateCount: number }>();

  seedTender(record: TenderDecisionOwnerRecord) {
    this.tenders.set(record.id, {
      ...record,
      updateCount: 0
    });
  }

  async findOwnedTender(
    tenderId: string,
    userId: string
  ): Promise<TenderDecisionOwnerRecord | null> {
    const tender = this.tenders.get(tenderId);

    if (!tender || tender.ownerId !== userId) {
      return null;
    }

    return tender;
  }

  async updateTenderDecision(
    tenderId: string,
    decision: TenderDecisionValue,
    reason: string
  ): Promise<UpdatedTenderDecisionRecord> {
    const tender = this.tenders.get(tenderId);

    if (!tender) {
      throw new Error("Missing fake tender.");
    }

    tender.updateCount += 1;

    return {
      id: tender.id,
      decision,
      decisionReason: reason
    };
  }
}

test("manual override rejects tenders owned by another user", async () => {
  const store = new MemoryDecisionStore();
  store.seedTender({ id: "foreign-tender", ownerId: "user-2" });

  const result = await setTenderDecisionForUser(store, "user-1", {
    tenderId: "foreign-tender",
    decision: "NO_BID",
    reason: "Нет доступной команды на подготовку."
  });

  assert.equal(result.ok, false);
  if (result.ok) {
    assert.fail("Expected manual override ownership check to fail.");
  }

  assert.equal(result.error.code, "NOT_FOUND");
  assert.equal(store.tenders.get("foreign-tender")?.updateCount, 0);
});

test("manual override saves decision with reason for owned tender", async () => {
  const store = new MemoryDecisionStore();
  store.seedTender({ id: "tender-1", ownerId: "user-1" });

  const result = await setTenderDecisionForUser(store, "user-1", {
    tenderId: "tender-1",
    decision: "REVIEW",
    reason: "Нужно проверить договор перед BID."
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected manual override to succeed.");
  }

  assert.equal(result.data.decision, "REVIEW");
  assert.equal(result.data.decisionReason, "Нужно проверить договор перед BID.");
  assert.equal(store.tenders.get("tender-1")?.updateCount, 1);
});

class MemoryRescoreStore implements RescoreTenderStore {
  savedScore: BidNoBidScore | null = null;

  constructor(private readonly tender: TenderScoringOwnerRecord | null) {}

  async findOwnedTenderForScoring(
    tenderId: string,
    userId: string
  ): Promise<TenderScoringOwnerRecord | null> {
    if (!this.tender || this.tender.id !== tenderId || this.tender.ownerId !== userId) {
      return null;
    }

    return this.tender;
  }

  async saveTenderScore(tenderId: string, score: BidNoBidScore) {
    assert.equal(tenderId, this.tender?.id);
    this.savedScore = score;

    return {
      id: tenderId
    };
  }
}

test("rescoreTenderForUser saves explainable score", async () => {
  const store = new MemoryRescoreStore(createHighFitTender());
  const result = await rescoreTenderForUser(store, "user-1", {
    tenderId: "tender-1"
  });

  assert.equal(result.ok, true);
  if (!result.ok) {
    assert.fail("Expected rescore to succeed.");
  }

  assert.equal(store.savedScore?.scoreBreakdown.version, "bid-no-bid-v1");
  assert.equal(result.data.tenderId, "tender-1");
  assert.equal(result.data.decision, store.savedScore?.decision);
});
