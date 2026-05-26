import { TenderSourceStage } from "@prisma/client";
import type { NormalizedTenderDTO } from "./normalized-tender-dto";

type DeriveSourceStageOptions = {
  now?: Date;
};

const CANCELLATION_MARKERS = ["cancel", "canceled", "cancelled", "cancellation", "отмен"];
const FINAL_PROTOCOL_MARKERS = ["final", "result", "итог", "результ", "заключитель"];

export function deriveSourceStage(
  tender: NormalizedTenderDTO,
  options: DeriveSourceStageOptions = {}
): TenderSourceStage {
  const now = options.now ?? new Date();
  const deadline = parseNullableDate(tender.deadlines.applicationDeadlineAt);
  const documents = tender.documents;

  if (hasCancellationMarker(tender)) {
    return TenderSourceStage.CANCELED;
  }

  if (documents.some(isResultDocument)) {
    return TenderSourceStage.COMPLETED;
  }

  if (documents.some((document) => document.type === "PROTOCOL")) {
    return TenderSourceStage.COMMISSION_WORK;
  }

  if (
    deadline &&
    deadline.getTime() >= now.getTime() &&
    documents.some((document) => document.type === "NOTICE" || document.type === "DOCUMENTATION")
  ) {
    return TenderSourceStage.SUBMISSION_OPEN;
  }

  if (deadline && deadline.getTime() < now.getTime()) {
    return TenderSourceStage.EXPIRED;
  }

  return TenderSourceStage.UNKNOWN;
}

function isResultDocument(document: NormalizedTenderDTO["documents"][number]) {
  if (document.type === "RESULT") {
    return true;
  }

  if (document.type !== "PROTOCOL") {
    return false;
  }

  const text = `${document.title} ${document.fileName ?? ""}`.toLocaleLowerCase("ru-RU");
  return FINAL_PROTOCOL_MARKERS.some((marker) => text.includes(marker));
}

function hasCancellationMarker(tender: NormalizedTenderDTO) {
  const documentText = tender.documents
    .map((document) => `${document.type} ${document.title} ${document.fileName ?? ""}`)
    .join(" ");
  const changeText = tender.changesFeed
    .map((change) => `${change.title} ${change.description ?? ""}`)
    .join(" ");
  const text = `${tender.statusName ?? ""} ${documentText} ${changeText}`.toLocaleLowerCase(
    "ru-RU"
  );

  return CANCELLATION_MARKERS.some((marker) => text.includes(marker));
}

function parseNullableDate(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}
