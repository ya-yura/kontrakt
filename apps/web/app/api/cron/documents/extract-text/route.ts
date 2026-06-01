import { NextResponse, type NextRequest } from "next/server";
import { validateCronAuthorization } from "@/src/watchlists/cron-auth";
import {
  DocumentExtractionRunAlreadyInProgressError,
  emptyDocumentExtractionRunSummary,
  runDocumentTextExtraction,
  type DocumentExtractionRunSummary
} from "@/src/documents/run-extraction";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSummary(
  overrides: Partial<DocumentExtractionRunSummary> = {}
): DocumentExtractionRunSummary {
  return emptyDocumentExtractionRunSummary(overrides);
}

export async function POST(request: NextRequest) {
  const authResult = validateCronAuthorization(request.headers.get("authorization"));

  if (!authResult.ok) {
    return NextResponse.json(
      {
        error: authResult.message,
        ...safeSummary({ errorsCount: 1 })
      },
      { status: authResult.status }
    );
  }

  try {
    const summary = await runDocumentTextExtraction({ useLock: true });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof DocumentExtractionRunAlreadyInProgressError) {
      return NextResponse.json(
        {
          error: "Document text extraction is already running.",
          ...safeSummary({ errorsCount: 1 })
        },
        { status: 409 }
      );
    }

    console.error("documents.extract_text.route_failed", {
      error: error instanceof Error ? error.message : "Unknown route error"
    });

    return NextResponse.json(
      {
        error: "Document text extraction failed.",
        ...safeSummary({ errorsCount: 1 })
      },
      { status: 500 }
    );
  }
}
