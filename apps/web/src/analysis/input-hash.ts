import { createHash } from "node:crypto";

export type AnalysisKind = "TENDER_SUMMARY" | "DOCUMENT_SUMMARY";

export type TenderAnalysisHashDocument = {
  id: string;
  textChecksum: string;
};

type CanonicalJson =
  | null
  | string
  | number
  | boolean
  | CanonicalJson[]
  | { [key: string]: CanonicalJson };

function canonicalize(value: unknown): CanonicalJson {
  if (value == null) {
    return null;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map((item) => canonicalize(item));
  }

  if (typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .sort(([left], [right]) => left.localeCompare(right, "en-US"));

    return Object.fromEntries(entries.map(([key, item]) => [key, canonicalize(item)]));
  }

  return String(value);
}

export function createStableInputHash(payload: unknown) {
  return createHash("sha256")
    .update(JSON.stringify(canonicalize(payload)))
    .digest("hex");
}

export function createTenderAnalysisInputHash(input: {
  tenderId: string;
  tenderPayloadHash: string | null;
  includedDocuments: TenderAnalysisHashDocument[];
}) {
  const includedDocumentChecksums = input.includedDocuments
    .map((document) => ({
      id: document.id,
      textChecksum: document.textChecksum
    }))
    .sort(
      (left, right) =>
        left.id.localeCompare(right.id, "en-US") ||
        left.textChecksum.localeCompare(right.textChecksum, "en-US")
    );

  return createStableInputHash({
    version: "ai-analysis-input-v1",
    kind: "TENDER_SUMMARY" satisfies AnalysisKind,
    tenderId: input.tenderId,
    tenderPayloadHash: input.tenderPayloadHash,
    includedDocumentChecksums
  });
}

export function createDocumentAnalysisInputHash(input: {
  tenderId: string;
  documentId: string;
  tenderPayloadHash: string | null;
  documentTextChecksum: string;
}) {
  return createStableInputHash({
    version: "ai-analysis-input-v1",
    kind: "DOCUMENT_SUMMARY" satisfies AnalysisKind,
    tenderId: input.tenderId,
    documentId: input.documentId,
    tenderPayloadHash: input.tenderPayloadHash,
    documentTextChecksum: input.documentTextChecksum
  });
}
