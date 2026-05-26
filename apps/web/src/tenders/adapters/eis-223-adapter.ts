import { eis223TenderFixtures } from "../fixtures/eis-223-tenders";

export type NormalizedTenderSourceStage =
  | "UNKNOWN"
  | "SUBMISSION_OPEN"
  | "COMMISSION_WORK"
  | "COMPLETED"
  | "CANCELED"
  | "EXPIRED";

export type NormalizedTenderDecision = "UNDECIDED" | "REVIEW" | "BID" | "NO_BID";

export type NormalizedDocumentType =
  | "NOTICE"
  | "PROCUREMENT_DOCUMENTATION"
  | "TECHNICAL_SPECIFICATION"
  | "DRAFT_CONTRACT"
  | "CLARIFICATION"
  | "PROTOCOL"
  | "OTHER";

export type NormalizedDocumentStatus = "AVAILABLE" | "EXTERNAL_ONLY" | "MISSING";

export type NormalizedEIS223Document = {
  externalId: string;
  type: NormalizedDocumentType;
  title: string;
  fileName?: string;
  status: NormalizedDocumentStatus;
  sourceUrl?: string;
};

export type NormalizedTenderChange = {
  at: string;
  title: string;
  description?: string;
};

export type NormalizedEIS223Tender = {
  externalId: string;
  registryNumber: string;
  lotNumber?: string;
  title: string;
  description?: string;
  customerInn: string;
  customerName: string;
  purchaseMethod: string;
  maxPrice: string;
  currency: "RUB";
  region: string;
  sourceUrl: string;
  publishedAt: string;
  applicationStartAt?: string;
  applicationDeadlineAt: string;
  clarificationDeadlineAt?: string;
  resultAt?: string;
  bidSecurityAmount?: string;
  contractSecurityAmount?: string;
  paymentTerms?: string;
  participationRequirements: string[];
  requiredDocuments: string[];
  evaluationCriteria: string[];
  changesFeed: NormalizedTenderChange[];
  sourceStage: NormalizedTenderSourceStage;
  kanbanStageCode: string;
  decision: NormalizedTenderDecision;
  documents: NormalizedEIS223Document[];
};

export type EIS223AdapterOptions = {
  fixtures?: readonly NormalizedEIS223Tender[];
};

export class EIS223Adapter {
  private readonly fixtures: readonly NormalizedEIS223Tender[];

  constructor(options: EIS223AdapterOptions = {}) {
    this.fixtures = options.fixtures ?? eis223TenderFixtures;
  }

  async listNormalizedTenders(): Promise<NormalizedEIS223Tender[]> {
    return this.fixtures.map((tender) => ({
      ...tender,
      participationRequirements: [...tender.participationRequirements],
      requiredDocuments: [...tender.requiredDocuments],
      evaluationCriteria: [...tender.evaluationCriteria],
      changesFeed: tender.changesFeed.map((change) => ({ ...change })),
      documents: tender.documents.map((document) => ({ ...document }))
    }));
  }
}
