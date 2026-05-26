import { createHash } from "node:crypto";
import type { NormalizedTenderDTO } from "@/src/tenders/normalized-tender-dto";

function stableJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(stableJsonValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, item]) => [key, stableJsonValue(item)])
    );
  }

  return value;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function md5(value: string) {
  return createHash("md5").update(value).digest("hex");
}

function canonicalJson(value: unknown) {
  return JSON.stringify(stableJsonValue(value));
}

export function computePayloadHash(dto: NormalizedTenderDTO) {
  const hashSource =
    dto.sourcePayload ??
    {
      externalPurchaseId: dto.externalPurchaseId,
      lotNumber: dto.lotNumber,
      sourceHash: dto.sourceHash,
      title: dto.title,
      deadlines: dto.deadlines,
      documents: dto.documents
    };

  return sha256(canonicalJson(hashSource));
}

export function createTenderSourceDedupeKey(
  userId: string,
  externalPurchaseId: string,
  lotNumber: string | null
) {
  return `owner:${userId}:external:${externalPurchaseId}:lot:${lotNumber ?? ""}`;
}

export function createDocumentDedupeKey(document: {
  externalDocumentId: string | null;
  sourceHash: string | null;
  sourceUrl: string | null;
  title: string;
}) {
  const externalDocumentId = document.externalDocumentId?.trim();

  if (externalDocumentId) {
    return `external:${externalDocumentId}`;
  }

  const sourceHash = document.sourceHash?.trim();

  if (sourceHash) {
    return `hash:${sourceHash}`;
  }

  const sourceUrl = document.sourceUrl?.trim();

  if (sourceUrl) {
    return `url:${sourceUrl}`;
  }

  return `title:${md5(document.title.trim().toLocaleLowerCase("ru-RU"))}`;
}
