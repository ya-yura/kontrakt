import { z, ZodError } from "zod";

export type BidNoBidDecision = "BID" | "REVIEW" | "NO_BID";
export type TenderDecisionValue = BidNoBidDecision | "UNDECIDED";

export type ScoringActionErrorCode =
  | "VALIDATION_ERROR"
  | "UNAUTHORIZED"
  | "NOT_FOUND"
  | "UNKNOWN_ERROR";

export type ScoringActionError = {
  code: ScoringActionErrorCode;
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export type ActionResult<T> =
  | {
      ok: true;
      data: T;
    }
  | {
      ok: false;
      error: ScoringActionError;
    };

type MoneyLike = string | number | { toString(): string } | null | undefined;

export type ScoringTenderDocument = {
  type: string;
  title?: string | null;
  fileName?: string | null;
  status: string;
  sourceUrl?: string | null;
  storageKey?: string | null;
};

export type ScoringAIAnalysis = {
  status?: string | null;
  score?: number | null;
  summary?: string | null;
  result?: unknown;
};

export type TenderScoringInput = {
  id: string;
  title: string;
  description?: string | null;
  customerName?: string | null;
  purchaseMethod?: string | null;
  initialPrice?: MoneyLike;
  currency?: string | null;
  region?: string | null;
  publishedAt?: Date | string | null;
  applicationStartAt?: Date | string | null;
  submissionDeadline?: Date | string | null;
  bidSecurityAmount?: MoneyLike;
  contractSecurityAmount?: MoneyLike;
  paymentTerms?: string | null;
  participationRequirements?: unknown;
  requiredDocuments?: unknown;
  evaluationCriteria?: unknown;
  sourceStage?: string | null;
  documents?: ScoringTenderDocument[];
  aiAnalyses?: ScoringAIAnalysis[];
};

export type UserScoringContext = {
  companyProfile?: unknown;
  scoringPolicy?: unknown;
};

export type ScoreFactor = {
  label: string;
  points: number;
  detail: string;
};

export type HardBlocker = {
  code:
    | "REQUIRED_LICENSE_UNAVAILABLE"
    | "REQUIRED_CERTIFICATE_UNAVAILABLE"
    | "UNSUPPORTED_REGION"
    | "SECURITY_ABOVE_LIMIT"
    | "PREPARATION_WINDOW_TOO_SHORT"
    | "UNACCEPTABLE_PAYMENT_TERMS"
    | "MANDATORY_EXPERIENCE_UNREACHABLE";
  label: string;
  detail: string;
};

export type ScoreCategoryBreakdown = {
  score: number;
  max: number;
  factors: ScoreFactor[];
};

export type BidNoBidBreakdown = {
  version: "bid-no-bid-v1";
  scoredAt: string;
  thresholds: {
    bid: number;
    review: number;
  };
  fit: ScoreCategoryBreakdown;
  economics: ScoreCategoryBreakdown;
  execution: ScoreCategoryBreakdown;
  compliance: ScoreCategoryBreakdown;
  urgency: ScoreCategoryBreakdown;
  confidence: {
    score: number;
    factors: ScoreFactor[];
  };
  hardBlockers: HardBlocker[];
  rawDecision: BidNoBidDecision;
  finalDecision: BidNoBidDecision;
};

export type BidNoBidScore = {
  scoreTotal: number;
  scoreFit: number;
  scoreEconomics: number;
  scoreExecutionRisk: number;
  scoreComplianceRisk: number;
  scoreUrgency: number;
  scoreConfidence: number;
  scoreBreakdown: BidNoBidBreakdown;
  decision: BidNoBidDecision;
  decisionReason: string;
  lastScoredAt: Date;
};

export type TenderScoringOwnerRecord = TenderScoringInput & {
  ownerId: string | null;
  owner?: UserScoringContext | null;
};

export type SavedTenderScoreRecord = {
  id: string;
};

export type RescoreTenderStore = {
  findOwnedTenderForScoring(
    tenderId: string,
    userId: string
  ): Promise<TenderScoringOwnerRecord | null>;
  saveTenderScore(tenderId: string, score: BidNoBidScore): Promise<SavedTenderScoreRecord>;
};

export type TenderDecisionOwnerRecord = {
  id: string;
  ownerId: string | null;
};

export type UpdatedTenderDecisionRecord = {
  id: string;
  decision: TenderDecisionValue;
  decisionReason: string | null;
};

export type SetTenderDecisionStore = {
  findOwnedTender(tenderId: string, userId: string): Promise<TenderDecisionOwnerRecord | null>;
  updateTenderDecision(
    tenderId: string,
    decision: TenderDecisionValue,
    reason: string
  ): Promise<UpdatedTenderDecisionRecord>;
};

export type TenderScoreMutationData = {
  tenderId: string;
  scoreTotal: number;
  scoreFit: number;
  scoreEconomics: number;
  scoreExecutionRisk: number;
  scoreComplianceRisk: number;
  scoreUrgency: number;
  scoreConfidence: number;
  scoreBreakdown: BidNoBidBreakdown;
  decision: BidNoBidDecision;
  decisionReason: string;
  lastScoredAt: string;
};

export type SetTenderDecisionData = {
  tenderId: string;
  decision: TenderDecisionValue;
  decisionReason: string;
};

const tenderIdSchema = z.string().trim().min(1, "Tender is required.");

export const rescoreTenderInputSchema = z
  .object({
    tenderId: tenderIdSchema
  })
  .strict();

export const setTenderDecisionInputSchema = z
  .object({
    tenderId: tenderIdSchema,
    decision: z.enum(["UNDECIDED", "REVIEW", "BID", "NO_BID"]),
    reason: z.string().trim().min(3, "Reason is required.").max(1000, "Reason is too long.")
  })
  .strict();

type NormalizedPolicy = {
  supportedRegions: string[];
  unsupportedRegions: string[];
  targetKeywords: string[];
  excludedKeywords: string[];
  preferredCustomers: string[];
  acceptedPurchaseMethods: string[];
  availableLicenses: string[] | null;
  availableCertificates: string[] | null;
  unavailableLicenses: string[];
  unavailableCertificates: string[];
  hasRequiredLicense?: boolean;
  hasRequiredCertificate?: boolean;
  mandatoryExperienceAvailable?: boolean;
  referencesAvailable?: boolean;
  maxBidSecurityAmount?: number;
  maxContractSecurityAmount?: number;
  maxTotalSecurityAmount?: number;
  maxSecurityAmount?: number;
  maxSecurityPercent?: number;
  minPreparationDays?: number;
  targetPriceMin?: number;
  targetPriceMax?: number;
  unacceptablePaymentTerms: string[];
};

type TenderSignals = {
  requirements: string[];
  requiredDocumentTexts: string[];
  evaluationCriteria: string[];
  searchableText: string;
  licenseRequired: boolean;
  certificateRequired: boolean;
  mandatoryExperienceRequired: boolean;
  referenceRequired: boolean;
  keyDocumentsMissing: boolean;
  hasRequirements: boolean;
  hasAIAnalysis: boolean;
  daysUntilDeadline: number | null;
  initialPrice: number | null;
  bidSecurityAmount: number | null;
  contractSecurityAmount: number | null;
  totalSecurityAmount: number;
};

export function scoringActionFailure(
  code: ScoringActionErrorCode,
  message: string
): ActionResult<never> {
  return {
    ok: false,
    error: {
      code,
      message
    }
  };
}

export function scoringValidationFailure(
  error: ZodError,
  message = "Проверьте параметры запроса."
): ActionResult<never> {
  const flattened = error.flatten();
  const rawFieldErrors = flattened.fieldErrors as Record<string, string[] | undefined>;
  const fieldErrors = Object.fromEntries(
    Object.entries(rawFieldErrors).filter(
      (entry): entry is [string, string[]] => Array.isArray(entry[1]) && entry[1].length > 0
    )
  ) as Record<string, string[]>;

  return {
    ok: false,
    error: {
      code: "VALIDATION_ERROR",
      message,
      fieldErrors
    }
  };
}

export function scoringNotFoundFailure(): ActionResult<never> {
  return scoringActionFailure("NOT_FOUND", "Закупка не найдена или принадлежит другому пользователю.");
}

export function decisionFromScore(scoreTotal: number): BidNoBidDecision {
  if (scoreTotal >= 70) {
    return "BID";
  }

  if (scoreTotal >= 50) {
    return "REVIEW";
  }

  return "NO_BID";
}

export function scoreTenderBidNoBid(
  tender: TenderScoringInput,
  context: UserScoringContext = {},
  scoredAt = new Date()
): BidNoBidScore {
  const policy = normalizePolicy(context.companyProfile, context.scoringPolicy);
  const signals = getTenderSignals(tender, scoredAt);
  const hardBlockers = getHardBlockers(tender, policy, signals);
  const fit = scoreFit(tender, policy, signals);
  const economics = scoreEconomics(tender, policy, signals);
  const execution = scoreExecution(tender, policy, signals);
  const compliance = scoreCompliance(policy, signals);
  const urgency = scoreUrgency(policy, signals);
  const confidence = scoreConfidence(context, signals);
  const scoreTotal = fit.score + economics.score + execution.score + compliance.score + urgency.score;
  const rawDecision = decisionFromScore(scoreTotal);
  let decision = rawDecision;
  const reasonParts: string[] = [];

  if (hardBlockers.length > 0) {
    decision = "NO_BID";
    reasonParts.push(`Hard blocker: ${hardBlockers.map((blocker) => blocker.label).join("; ")}.`);
  } else if (confidence.score < 60 && rawDecision === "BID") {
    decision = "REVIEW";
    reasonParts.push(`Confidence ${confidence.score} ниже 60, поэтому BID понижен до REVIEW.`);
  } else {
    reasonParts.push(`Threshold decision: ${rawDecision} при scoreTotal ${scoreTotal}.`);
  }

  reasonParts.push(
    `fit ${fit.score}/30, economics ${economics.score}/20, execution ${execution.score}/20, compliance ${compliance.score}/20, urgency ${urgency.score}/10.`
  );

  const breakdown: BidNoBidBreakdown = {
    version: "bid-no-bid-v1",
    scoredAt: scoredAt.toISOString(),
    thresholds: {
      bid: 70,
      review: 50
    },
    fit,
    economics,
    execution,
    compliance,
    urgency,
    confidence,
    hardBlockers,
    rawDecision,
    finalDecision: decision
  };

  return {
    scoreTotal,
    scoreFit: fit.score,
    scoreEconomics: economics.score,
    scoreExecutionRisk: execution.score,
    scoreComplianceRisk: compliance.score,
    scoreUrgency: urgency.score,
    scoreConfidence: confidence.score,
    scoreBreakdown: breakdown,
    decision,
    decisionReason: reasonParts.join(" "),
    lastScoredAt: scoredAt
  };
}

export async function rescoreTenderForUser(
  store: RescoreTenderStore,
  userId: string,
  input: unknown
): Promise<ActionResult<TenderScoreMutationData>> {
  const parsed = rescoreTenderInputSchema.safeParse(input);

  if (!parsed.success) {
    return scoringValidationFailure(parsed.error, "Проверьте параметры пересчета.");
  }

  const tender = await store.findOwnedTenderForScoring(parsed.data.tenderId, userId);

  if (!tender) {
    return scoringNotFoundFailure();
  }

  const score = scoreTenderBidNoBid(tender, tender.owner ?? {});
  await store.saveTenderScore(tender.id, score);

  return {
    ok: true,
    data: serializeTenderScore(tender.id, score)
  };
}

export async function setTenderDecisionForUser(
  store: SetTenderDecisionStore,
  userId: string,
  input: unknown
): Promise<ActionResult<SetTenderDecisionData>> {
  const parsed = setTenderDecisionInputSchema.safeParse(input);

  if (!parsed.success) {
    return scoringValidationFailure(parsed.error, "Проверьте решение и причину.");
  }

  const tender = await store.findOwnedTender(parsed.data.tenderId, userId);

  if (!tender) {
    return scoringNotFoundFailure();
  }

  const updated = await store.updateTenderDecision(
    tender.id,
    parsed.data.decision,
    parsed.data.reason
  );

  return {
    ok: true,
    data: {
      tenderId: updated.id,
      decision: updated.decision,
      decisionReason: updated.decisionReason ?? ""
    }
  };
}

function serializeTenderScore(tenderId: string, score: BidNoBidScore): TenderScoreMutationData {
  return {
    tenderId,
    scoreTotal: score.scoreTotal,
    scoreFit: score.scoreFit,
    scoreEconomics: score.scoreEconomics,
    scoreExecutionRisk: score.scoreExecutionRisk,
    scoreComplianceRisk: score.scoreComplianceRisk,
    scoreUrgency: score.scoreUrgency,
    scoreConfidence: score.scoreConfidence,
    scoreBreakdown: score.scoreBreakdown,
    decision: score.decision,
    decisionReason: score.decisionReason,
    lastScoredAt: score.lastScoredAt.toISOString()
  };
}

function getTenderSignals(tender: TenderScoringInput, scoredAt: Date): TenderSignals {
  const requirements = stringsFromJson(tender.participationRequirements);
  const requiredDocumentTexts = stringsFromJson(tender.requiredDocuments);
  const evaluationCriteria = stringsFromJson(tender.evaluationCriteria);
  const documents = tender.documents ?? [];
  const allDocumentText = documents.flatMap((document) => [
    document.type,
    document.title ?? "",
    document.fileName ?? ""
  ]);
  const searchableText = normalizeText(
    [
      tender.title,
      tender.description,
      tender.customerName,
      tender.purchaseMethod,
      tender.region,
      tender.paymentTerms,
      ...requirements,
      ...requiredDocumentTexts,
      ...evaluationCriteria,
      ...allDocumentText
    ].join(" ")
  );
  const daysUntilDeadline = getDaysUntil(tender.submissionDeadline, scoredAt);
  const initialPrice = moneyToNumber(tender.initialPrice);
  const bidSecurityAmount = moneyToNumber(tender.bidSecurityAmount);
  const contractSecurityAmount = moneyToNumber(tender.contractSecurityAmount);
  const totalSecurityAmount = (bidSecurityAmount ?? 0) + (contractSecurityAmount ?? 0);
  const keyDocumentsMissing =
    documents.length === 0 ||
    documents.some((document) => document.status === "MISSING") ||
    requiredDocumentTexts.length === 0;
  const hasAIAnalysis = (tender.aiAnalyses ?? []).some(
    (analysis) =>
      analysis.status === "SUCCEEDED" ||
      analysis.score != null ||
      Boolean(analysis.summary) ||
      analysis.result != null
  );

  return {
    requirements,
    requiredDocumentTexts,
    evaluationCriteria,
    searchableText,
    licenseRequired: includesAny(searchableText, ["лиценз", "license"]),
    certificateRequired: includesAny(searchableText, [
      "сертифик",
      "certificate",
      "регистрационн",
      "удостоверен"
    ]),
    mandatoryExperienceRequired: includesAny(searchableText, [
      "опыт",
      "experience",
      "аналогич",
      "поставок"
    ]),
    referenceRequired: includesAny(searchableText, ["референс", "reference", "отзыв"]),
    keyDocumentsMissing,
    hasRequirements: requirements.length > 0 || requiredDocumentTexts.length > 0,
    hasAIAnalysis,
    daysUntilDeadline,
    initialPrice,
    bidSecurityAmount,
    contractSecurityAmount,
    totalSecurityAmount
  };
}

function getHardBlockers(
  tender: TenderScoringInput,
  policy: NormalizedPolicy,
  signals: TenderSignals
): HardBlocker[] {
  const blockers: HardBlocker[] = [];
  const region = tender.region ?? "";

  if (matchesAny(region, policy.unsupportedRegions)) {
    blockers.push({
      code: "UNSUPPORTED_REGION",
      label: "unsupported region",
      detail: `Регион ${region} находится в unsupportedRegions.`
    });
  } else if (policy.supportedRegions.length > 0 && !matchesAny(region, policy.supportedRegions)) {
    blockers.push({
      code: "UNSUPPORTED_REGION",
      label: "unsupported region",
      detail: `Регион ${region || "не указан"} не входит в supportedRegions.`
    });
  }

  if (signals.licenseRequired && isAvailabilityMissing(policy.availableLicenses, policy.hasRequiredLicense)) {
    blockers.push({
      code: "REQUIRED_LICENSE_UNAVAILABLE",
      label: "required license unavailable",
      detail: "Требования содержат лицензию, но policy/profile не подтверждает доступную лицензию."
    });
  }

  if (
    signals.licenseRequired &&
    policy.unavailableLicenses.length > 0 &&
    containsAnyConfiguredTerm(signals.searchableText, policy.unavailableLicenses)
  ) {
    blockers.push({
      code: "REQUIRED_LICENSE_UNAVAILABLE",
      label: "required license unavailable",
      detail: "Требуемая лицензия совпала с unavailableLicenses."
    });
  }

  if (
    signals.certificateRequired &&
    isAvailabilityMissing(policy.availableCertificates, policy.hasRequiredCertificate)
  ) {
    blockers.push({
      code: "REQUIRED_CERTIFICATE_UNAVAILABLE",
      label: "required certificate unavailable",
      detail: "Требования содержат сертификат, но policy/profile не подтверждает доступный сертификат."
    });
  }

  if (
    signals.certificateRequired &&
    policy.unavailableCertificates.length > 0 &&
    containsAnyConfiguredTerm(signals.searchableText, policy.unavailableCertificates)
  ) {
    blockers.push({
      code: "REQUIRED_CERTIFICATE_UNAVAILABLE",
      label: "required certificate unavailable",
      detail: "Требуемый сертификат совпал с unavailableCertificates."
    });
  }

  const securityBlocker = securityLimitBlocker(policy, signals);

  if (securityBlocker) {
    blockers.push(securityBlocker);
  }

  if (
    policy.minPreparationDays != null &&
    signals.daysUntilDeadline != null &&
    signals.daysUntilDeadline < policy.minPreparationDays
  ) {
    blockers.push({
      code: "PREPARATION_WINDOW_TOO_SHORT",
      label: "preparation window below minimum",
      detail: `До дедлайна ${round1(signals.daysUntilDeadline)} д, минимум ${policy.minPreparationDays} д.`
    });
  }

  if (
    tender.paymentTerms &&
    policy.unacceptablePaymentTerms.length > 0 &&
    containsAnyConfiguredTerm(tender.paymentTerms, policy.unacceptablePaymentTerms)
  ) {
    blockers.push({
      code: "UNACCEPTABLE_PAYMENT_TERMS",
      label: "unacceptable payment terms",
      detail: "Payment terms matched unacceptablePaymentTerms."
    });
  }

  if (
    (signals.mandatoryExperienceRequired || signals.referenceRequired) &&
    (policy.mandatoryExperienceAvailable === false || policy.referencesAvailable === false)
  ) {
    blockers.push({
      code: "MANDATORY_EXPERIENCE_UNREACHABLE",
      label: "mandatory experience/reference unreachable",
      detail: "Требуется опыт или референс, но profile/policy помечает его как недоступный."
    });
  }

  return blockers;
}

function scoreFit(
  tender: TenderScoringInput,
  policy: NormalizedPolicy,
  signals: TenderSignals
): ScoreCategoryBreakdown {
  const factors: ScoreFactor[] = [];
  let score = 8;

  factors.push({
    label: "baseline",
    points: 8,
    detail: "Базовый fit за наличие нормализованной карточки."
  });

  if (!tender.region) {
    score += 2;
    factors.push({ label: "region unknown", points: 2, detail: "Регион не указан." });
  } else if (policy.supportedRegions.length === 0) {
    score += 6;
    factors.push({
      label: "region neutral",
      points: 6,
      detail: "supportedRegions не задан, регион не штрафуется."
    });
  } else if (matchesAny(tender.region, policy.supportedRegions)) {
    score += 8;
    factors.push({ label: "region fit", points: 8, detail: "Регион входит в supportedRegions." });
  }

  const keywordMatches = policy.targetKeywords.filter((keyword) =>
    signals.searchableText.includes(normalizeText(keyword))
  );

  if (policy.targetKeywords.length === 0) {
    score += 8;
    factors.push({
      label: "keyword neutral",
      points: 8,
      detail: "targetKeywords не заданы, профильный fit считается нейтральным."
    });
  } else if (keywordMatches.length >= 2) {
    score += 10;
    factors.push({
      label: "keyword fit",
      points: 10,
      detail: `Совпали ключевые слова: ${keywordMatches.slice(0, 4).join(", ")}.`
    });
  } else if (keywordMatches.length === 1) {
    score += 6;
    factors.push({
      label: "keyword partial fit",
      points: 6,
      detail: `Совпало ключевое слово: ${keywordMatches[0]}.`
    });
  }

  if (matchesAny(tender.customerName ?? "", policy.preferredCustomers)) {
    score += 4;
    factors.push({ label: "customer fit", points: 4, detail: "Заказчик в preferredCustomers." });
  } else if (policy.preferredCustomers.length === 0) {
    score += 2;
    factors.push({ label: "customer neutral", points: 2, detail: "preferredCustomers не заданы." });
  }

  if (matchesAny(tender.purchaseMethod ?? "", policy.acceptedPurchaseMethods)) {
    score += 3;
    factors.push({
      label: "purchase method fit",
      points: 3,
      detail: "Способ закупки входит в acceptedPurchaseMethods."
    });
  } else if (policy.acceptedPurchaseMethods.length === 0) {
    score += 2;
    factors.push({
      label: "purchase method neutral",
      points: 2,
      detail: "acceptedPurchaseMethods не заданы."
    });
  }

  const excludedMatch = policy.excludedKeywords.find((keyword) =>
    signals.searchableText.includes(normalizeText(keyword))
  );

  if (excludedMatch) {
    score -= 6;
    factors.push({
      label: "excluded keyword",
      points: -6,
      detail: `Найдено excludedKeyword: ${excludedMatch}.`
    });
  }

  return category(clampScore(score, 0, 30), 30, factors);
}

function scoreEconomics(
  tender: TenderScoringInput,
  policy: NormalizedPolicy,
  signals: TenderSignals
): ScoreCategoryBreakdown {
  const factors: ScoreFactor[] = [];
  let score = 0;

  if (signals.initialPrice == null) {
    score += 4;
    factors.push({ label: "price missing", points: 4, detail: "Max price не указан." });
  } else if (
    (policy.targetPriceMin == null || signals.initialPrice >= policy.targetPriceMin) &&
    (policy.targetPriceMax == null || signals.initialPrice <= policy.targetPriceMax)
  ) {
    score += 7;
    factors.push({ label: "price fit", points: 7, detail: "Max price входит в целевой диапазон." });
  } else {
    score += 4;
    factors.push({
      label: "price outside target",
      points: 4,
      detail: "Max price вне целевого диапазона, но не является hard blocker."
    });
  }

  const securityRatio =
    signals.initialPrice && signals.initialPrice > 0
      ? signals.totalSecurityAmount / signals.initialPrice
      : null;

  if (signals.totalSecurityAmount === 0) {
    score += 6;
    factors.push({ label: "no security", points: 6, detail: "Обеспечение не требуется или равно 0." });
  } else if (securityRatio != null && securityRatio <= 0.05) {
    score += 6;
    factors.push({ label: "low security", points: 6, detail: "Обеспечение до 5% от цены." });
  } else if (securityRatio != null && securityRatio <= 0.1) {
    score += 4;
    factors.push({ label: "medium security", points: 4, detail: "Обеспечение до 10% от цены." });
  } else {
    score += 2;
    factors.push({ label: "high security", points: 2, detail: "Обеспечение выше 10% от цены." });
  }

  if (!tender.paymentTerms) {
    score += 3;
    factors.push({ label: "payment terms missing", points: 3, detail: "Условия оплаты не указаны." });
  } else if (includesAny(tender.paymentTerms, ["аванс", "prepay", "предоплат"])) {
    score += 5;
    factors.push({ label: "advance payment", points: 5, detail: "Есть аванс или предоплата." });
  } else if (includesAny(tender.paymentTerms, ["7 рабочих", "10 рабочих", "15 рабочих", "30"])) {
    score += 4;
    factors.push({ label: "standard payment", points: 4, detail: "Оплата в стандартный срок." });
  } else {
    score += 3;
    factors.push({ label: "payment neutral", points: 3, detail: "Условия оплаты не выглядят блокером." });
  }

  const belowLimits =
    !securityLimitBlocker(policy, signals) &&
    (policy.maxSecurityAmount != null ||
      policy.maxBidSecurityAmount != null ||
      policy.maxContractSecurityAmount != null ||
      policy.maxTotalSecurityAmount != null);

  if (belowLimits) {
    score += 2;
    factors.push({ label: "security within limits", points: 2, detail: "Обеспечение в лимитах." });
  }

  return category(clampScore(score, 0, 20), 20, factors);
}

function scoreExecution(
  tender: TenderScoringInput,
  policy: NormalizedPolicy,
  signals: TenderSignals
): ScoreCategoryBreakdown {
  const factors: ScoreFactor[] = [];
  let score = 0;
  const minPreparationDays = policy.minPreparationDays ?? 3;

  if (signals.daysUntilDeadline == null) {
    score += 4;
    factors.push({ label: "deadline missing", points: 4, detail: "Дедлайн не указан." });
  } else if (signals.daysUntilDeadline <= 0) {
    factors.push({ label: "deadline passed", points: 0, detail: "Дедлайн уже прошел." });
  } else if (signals.daysUntilDeadline >= minPreparationDays + 5) {
    score += 8;
    factors.push({ label: "healthy prep window", points: 8, detail: "Есть запас на подготовку." });
  } else if (signals.daysUntilDeadline >= minPreparationDays) {
    score += 6;
    factors.push({ label: "enough prep window", points: 6, detail: "Окно подготовки в минимуме." });
  } else {
    score += 2;
    factors.push({ label: "short prep window", points: 2, detail: "Окно подготовки короткое." });
  }

  if ((tender.documents ?? []).length === 0) {
    score += 2;
    factors.push({ label: "documents absent", points: 2, detail: "Документы не нормализованы." });
  } else if (signals.keyDocumentsMissing) {
    score += 3;
    factors.push({ label: "documents partial", points: 3, detail: "Есть отсутствующие или неполные документы." });
  } else {
    score += 6;
    factors.push({ label: "documents available", points: 6, detail: "Ключевые документы доступны." });
  }

  if (tender.sourceStage === "SUBMISSION_OPEN") {
    score += 4;
    factors.push({ label: "submission open", points: 4, detail: "Прием заявок открыт." });
  } else if (tender.sourceStage === "UNKNOWN") {
    score += 2;
    factors.push({ label: "source stage unknown", points: 2, detail: "sourceStage не определен." });
  } else {
    score += 1;
    factors.push({ label: "source stage risk", points: 1, detail: "sourceStage не равен SUBMISSION_OPEN." });
  }

  if (includesAny(tender.purchaseMethod ?? "", ["электрон", "electronic"])) {
    score += 2;
    factors.push({ label: "electronic method", points: 2, detail: "Способ закупки электронный." });
  }

  return category(clampScore(score, 0, 20), 20, factors);
}

function scoreCompliance(
  policy: NormalizedPolicy,
  signals: TenderSignals
): ScoreCategoryBreakdown {
  const factors: ScoreFactor[] = [];
  let score = 0;

  if (signals.hasRequirements) {
    score += 4;
    factors.push({ label: "requirements present", points: 4, detail: "Требования нормализованы." });
  } else {
    score += 1;
    factors.push({ label: "requirements missing", points: 1, detail: "Требования отсутствуют." });
  }

  if (!signals.licenseRequired && !signals.certificateRequired) {
    score += 6;
    factors.push({
      label: "no special license signal",
      points: 6,
      detail: "Не найдено явных лицензий или сертификатов."
    });
  } else if (
    (!signals.licenseRequired || !isAvailabilityMissing(policy.availableLicenses, policy.hasRequiredLicense)) &&
    (!signals.certificateRequired ||
      !isAvailabilityMissing(policy.availableCertificates, policy.hasRequiredCertificate))
  ) {
    score += 6;
    factors.push({
      label: "license/certificate covered",
      points: 6,
      detail: "Профиль подтверждает доступность лицензий или сертификатов."
    });
  } else {
    score += 2;
    factors.push({
      label: "license/certificate uncertain",
      points: 2,
      detail: "Есть требования к лицензиям или сертификатам без полного подтверждения."
    });
  }

  if (signals.requiredDocumentTexts.length > 0) {
    score += 4;
    factors.push({ label: "required docs listed", points: 4, detail: "Перечень документов есть." });
  } else {
    score += 1;
    factors.push({ label: "required docs missing", points: 1, detail: "Перечень документов отсутствует." });
  }

  if (signals.evaluationCriteria.length > 0) {
    score += 2;
    factors.push({ label: "criteria present", points: 2, detail: "Критерии оценки нормализованы." });
  }

  if (!signals.keyDocumentsMissing) {
    score += 4;
    factors.push({ label: "key docs available", points: 4, detail: "Ключевые документы не помечены missing." });
  } else {
    score += 1;
    factors.push({ label: "key docs risk", points: 1, detail: "Есть риск отсутствующих документов." });
  }

  return category(clampScore(score, 0, 20), 20, factors);
}

function scoreUrgency(
  policy: NormalizedPolicy,
  signals: TenderSignals
): ScoreCategoryBreakdown {
  const factors: ScoreFactor[] = [];
  const minPreparationDays = policy.minPreparationDays ?? 3;
  let score = 0;

  if (signals.daysUntilDeadline == null) {
    score = 4;
    factors.push({ label: "deadline unknown", points: 4, detail: "Дедлайн неизвестен." });
  } else if (signals.daysUntilDeadline <= 0) {
    factors.push({ label: "deadline passed", points: 0, detail: "Дедлайн прошел." });
  } else if (signals.daysUntilDeadline < minPreparationDays) {
    score = 3;
    factors.push({ label: "too urgent", points: 3, detail: "Слишком мало времени до дедлайна." });
  } else if (signals.daysUntilDeadline <= 14) {
    score = 10;
    factors.push({ label: "actionable urgency", points: 10, detail: "Дедлайн близко, но окно рабочее." });
  } else if (signals.daysUntilDeadline <= 30) {
    score = 8;
    factors.push({ label: "medium urgency", points: 8, detail: "Есть время, но закупка актуальна." });
  } else {
    score = 6;
    factors.push({ label: "low urgency", points: 6, detail: "Дедлайн далеко." });
  }

  return category(clampScore(score, 0, 10), 10, factors);
}

function scoreConfidence(
  context: UserScoringContext,
  signals: TenderSignals
): { score: number; factors: ScoreFactor[] } {
  const factors: ScoreFactor[] = [];
  let score = 90;

  if (!signals.hasAIAnalysis) {
    score -= 15;
    factors.push({ label: "no AIAnalysis", points: -15, detail: "AIAnalysis отсутствует или пуст." });
  } else {
    factors.push({ label: "AIAnalysis present", points: 0, detail: "Есть AIAnalysis signal." });
  }

  if (!signals.hasRequirements) {
    score -= 15;
    factors.push({ label: "requirements missing", points: -15, detail: "Требования не нормализованы." });
  }

  if (signals.keyDocumentsMissing) {
    score -= 20;
    factors.push({ label: "key docs missing", points: -20, detail: "Ключевые документы отсутствуют или неполны." });
  }

  if (!isPlainObject(context.companyProfile) && !isPlainObject(context.scoringPolicy)) {
    score -= 10;
    factors.push({ label: "profile missing", points: -10, detail: "companyProfile/scoringPolicy не заданы." });
  }

  if (signals.initialPrice == null) {
    score -= 5;
    factors.push({ label: "price missing", points: -5, detail: "Нет max price." });
  }

  if (signals.daysUntilDeadline == null) {
    score -= 5;
    factors.push({ label: "deadline missing", points: -5, detail: "Нет submissionDeadline." });
  }

  return {
    score: clampScore(score, 0, 100),
    factors
  };
}

function normalizePolicy(companyProfile: unknown, scoringPolicy: unknown): NormalizedPolicy {
  const profile = toRecord(companyProfile);
  const policy = toRecord(scoringPolicy);
  const sources = [profile, policy].filter((source): source is Record<string, unknown> => Boolean(source));
  const availableLicenses = readOptionalArray(sources, [
    "availableLicenses",
    "licenses",
    "licenseKeys",
    "licenseKeywords"
  ]);
  const availableCertificates = readOptionalArray(sources, [
    "availableCertificates",
    "certificates",
    "certificateKeys",
    "certificateKeywords"
  ]);

  return {
    supportedRegions: readStringArray(sources, ["supportedRegions", "regions", "operatingRegions"]),
    unsupportedRegions: readStringArray(sources, ["unsupportedRegions", "blockedRegions"]),
    targetKeywords: readStringArray(sources, ["targetKeywords", "keywords", "fitKeywords"]),
    excludedKeywords: readStringArray(sources, ["excludedKeywords", "blockedKeywords"]),
    preferredCustomers: readStringArray(sources, ["preferredCustomers", "targetCustomers"]),
    acceptedPurchaseMethods: readStringArray(sources, ["acceptedPurchaseMethods", "purchaseMethods"]),
    availableLicenses,
    availableCertificates,
    unavailableLicenses: readStringArray(sources, ["unavailableLicenses", "missingLicenses"]),
    unavailableCertificates: readStringArray(sources, ["unavailableCertificates", "missingCertificates"]),
    hasRequiredLicense: readOptionalBoolean(sources, [
      "hasRequiredLicense",
      "licenseAvailable",
      "licensesAvailable"
    ]),
    hasRequiredCertificate: readOptionalBoolean(sources, [
      "hasRequiredCertificate",
      "certificateAvailable",
      "certificatesAvailable"
    ]),
    mandatoryExperienceAvailable: readOptionalBoolean(sources, [
      "mandatoryExperienceAvailable",
      "experienceAvailable",
      "hasMandatoryExperience"
    ]),
    referencesAvailable: readOptionalBoolean(sources, [
      "referencesAvailable",
      "referenceAvailable",
      "hasReferences"
    ]),
    maxBidSecurityAmount: readOptionalNumber(sources, ["maxBidSecurityAmount", "bidSecurityLimit"]),
    maxContractSecurityAmount: readOptionalNumber(sources, [
      "maxContractSecurityAmount",
      "contractSecurityLimit"
    ]),
    maxTotalSecurityAmount: readOptionalNumber(sources, ["maxTotalSecurityAmount", "totalSecurityLimit"]),
    maxSecurityAmount: readOptionalNumber(sources, ["maxSecurityAmount", "securityAmountLimit"]),
    maxSecurityPercent: readOptionalNumber(sources, ["maxSecurityPercent", "securityPercentLimit"]),
    minPreparationDays: readOptionalNumber(sources, ["minPreparationDays", "minimumPreparationDays"]),
    targetPriceMin: readOptionalNumber(sources, ["targetPriceMin", "minContractValue"]),
    targetPriceMax: readOptionalNumber(sources, ["targetPriceMax", "maxContractValue"]),
    unacceptablePaymentTerms: readStringArray(sources, [
      "unacceptablePaymentTerms",
      "blockedPaymentTerms",
      "unacceptablePaymentPatterns"
    ])
  };
}

function securityLimitBlocker(
  policy: NormalizedPolicy,
  signals: TenderSignals
): HardBlocker | null {
  if (
    policy.maxBidSecurityAmount != null &&
    signals.bidSecurityAmount != null &&
    signals.bidSecurityAmount > policy.maxBidSecurityAmount
  ) {
    return {
      code: "SECURITY_ABOVE_LIMIT",
      label: "security amount above company limit",
      detail: `bidSecurityAmount ${signals.bidSecurityAmount} выше лимита ${policy.maxBidSecurityAmount}.`
    };
  }

  if (
    policy.maxContractSecurityAmount != null &&
    signals.contractSecurityAmount != null &&
    signals.contractSecurityAmount > policy.maxContractSecurityAmount
  ) {
    return {
      code: "SECURITY_ABOVE_LIMIT",
      label: "security amount above company limit",
      detail: `contractSecurityAmount ${signals.contractSecurityAmount} выше лимита ${policy.maxContractSecurityAmount}.`
    };
  }

  if (
    policy.maxTotalSecurityAmount != null &&
    signals.totalSecurityAmount > policy.maxTotalSecurityAmount
  ) {
    return {
      code: "SECURITY_ABOVE_LIMIT",
      label: "security amount above company limit",
      detail: `Total security ${signals.totalSecurityAmount} выше лимита ${policy.maxTotalSecurityAmount}.`
    };
  }

  const maxIndividualSecurity = Math.max(
    signals.bidSecurityAmount ?? 0,
    signals.contractSecurityAmount ?? 0
  );

  if (policy.maxSecurityAmount != null && maxIndividualSecurity > policy.maxSecurityAmount) {
    return {
      code: "SECURITY_ABOVE_LIMIT",
      label: "security amount above company limit",
      detail: `Security amount ${maxIndividualSecurity} выше лимита ${policy.maxSecurityAmount}.`
    };
  }

  if (
    policy.maxSecurityPercent != null &&
    signals.initialPrice != null &&
    signals.initialPrice > 0 &&
    (signals.totalSecurityAmount / signals.initialPrice) * 100 > policy.maxSecurityPercent
  ) {
    return {
      code: "SECURITY_ABOVE_LIMIT",
      label: "security amount above company limit",
      detail: `Security percent выше лимита ${policy.maxSecurityPercent}%.`
    };
  }

  return null;
}

function category(score: number, max: number, factors: ScoreFactor[]): ScoreCategoryBreakdown {
  return {
    score,
    max,
    factors
  };
}

function isAvailabilityMissing(values: string[] | null, explicitFlag: boolean | undefined) {
  if (explicitFlag === false) {
    return true;
  }

  if (explicitFlag === true) {
    return false;
  }

  return Array.isArray(values) && values.length === 0;
}

function stringsFromJson(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((item) => {
    if (typeof item === "string") {
      const text = item.trim();
      return text ? [text] : [];
    }

    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return [];
    }

    const record = item as Record<string, unknown>;
    return ["title", "name", "label", "fileName", "type"]
      .map((key) => record[key])
      .filter((entry): entry is string => typeof entry === "string" && entry.trim() !== "")
      .map((entry) => entry.trim());
  });
}

function readStringArray(sources: Record<string, unknown>[], keys: string[]): string[] {
  return uniqueStrings(
    sources.flatMap((source) =>
      keys.flatMap((key) => {
        const value = source[key];

        if (Array.isArray(value)) {
          return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
        }

        if (typeof value === "string" && value.trim() !== "") {
          return [value];
        }

        return [];
      })
    )
  );
}

function readOptionalArray(sources: Record<string, unknown>[], keys: string[]): string[] | null {
  let found = false;
  const values = sources.flatMap((source) =>
    keys.flatMap((key) => {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        found = true;
      }

      const value = source[key];

      if (Array.isArray(value)) {
        return value.filter((item): item is string => typeof item === "string" && item.trim() !== "");
      }

      if (typeof value === "string" && value.trim() !== "") {
        return [value];
      }

      return [];
    })
  );

  return found ? uniqueStrings(values) : null;
}

function readOptionalNumber(sources: Record<string, unknown>[], keys: string[]) {
  for (const source of [...sources].reverse()) {
    for (const key of keys) {
      const value = source[key];
      const numberValue = typeof value === "string" ? Number(value) : value;

      if (typeof numberValue === "number" && Number.isFinite(numberValue)) {
        return numberValue;
      }
    }
  }

  return undefined;
}

function readOptionalBoolean(sources: Record<string, unknown>[], keys: string[]) {
  for (const source of [...sources].reverse()) {
    for (const key of keys) {
      const value = source[key];

      if (typeof value === "boolean") {
        return value;
      }
    }
  }

  return undefined;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function moneyToNumber(value: MoneyLike): number | null {
  if (value == null) {
    return null;
  }

  const raw = typeof value === "number" ? value : Number(value.toString());

  return Number.isFinite(raw) ? raw : null;
}

function getDaysUntil(value: Date | string | null | undefined, now: Date): number | null {
  if (!value) {
    return null;
  }

  const deadline = typeof value === "string" ? new Date(value) : value;
  const milliseconds = deadline.getTime() - now.getTime();

  if (!Number.isFinite(milliseconds)) {
    return null;
  }

  return milliseconds / (1000 * 60 * 60 * 24);
}

function matchesAny(value: string, candidates: string[]) {
  const normalizedValue = normalizeText(value);

  return candidates.some((candidate) => {
    const normalizedCandidate = normalizeText(candidate);
    return normalizedValue === normalizedCandidate || normalizedValue.includes(normalizedCandidate);
  });
}

function containsAnyConfiguredTerm(value: string, candidates: string[]) {
  const normalizedValue = normalizeText(value);

  return candidates.some((candidate) => normalizedValue.includes(normalizeText(candidate)));
}

function includesAny(value: string, terms: string[]) {
  const normalizedValue = normalizeText(value);

  return terms.some((term) => normalizedValue.includes(normalizeText(term)));
}

function normalizeText(value: string) {
  return value.toLocaleLowerCase("ru-RU").replaceAll("ё", "е").trim();
}

function toRecord(value: unknown): Record<string, unknown> | null {
  return isPlainObject(value) ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clampScore(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function round1(value: number) {
  return Math.round(value * 10) / 10;
}
