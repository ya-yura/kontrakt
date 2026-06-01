import { NextResponse, type NextRequest } from "next/server";
import { validateCronAuthorization } from "@/src/watchlists/cron-auth";
import {
  AnalysisRunAlreadyInProgressError,
  emptyAnalysisRunSummary,
  runAnalysis,
  type AnalysisRunSummary
} from "@/src/analysis/run-analysis";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSummary(overrides: Partial<AnalysisRunSummary> = {}): AnalysisRunSummary {
  return emptyAnalysisRunSummary(overrides);
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
    const summary = await runAnalysis({ useLock: true });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AnalysisRunAlreadyInProgressError) {
      return NextResponse.json(
        {
          error: "AI analysis execution is already running.",
          ...safeSummary({ errorsCount: 1 })
        },
        { status: 409 }
      );
    }

    console.error("analysis.run.route_failed", {
      error: error instanceof Error ? error.message : "Unknown route error"
    });

    return NextResponse.json(
      {
        error: "AI analysis execution failed.",
        ...safeSummary({ errorsCount: 1 })
      },
      { status: 500 }
    );
  }
}
