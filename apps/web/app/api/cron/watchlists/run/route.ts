import { NextResponse, type NextRequest } from "next/server";
import { validateCronAuthorization } from "@/src/watchlists/cron-auth";
import {
  runWatchlists,
  WatchlistRunAlreadyInProgressError,
  type WatchlistRunSummary
} from "@/src/watchlists/run-watchlists";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSummary(overrides: Partial<WatchlistRunSummary> = {}): WatchlistRunSummary {
  return {
    filtersProcessed: 0,
    tendersCreated: 0,
    tendersUpdated: 0,
    documentsUpserted: 0,
    errorsCount: 0,
    ...overrides
  };
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
    const summary = await runWatchlists({ useLock: true });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof WatchlistRunAlreadyInProgressError) {
      return NextResponse.json(
        {
          error: "Watchlist execution is already running.",
          ...safeSummary({ errorsCount: 1 })
        },
        { status: 409 }
      );
    }

    console.error("watchlists.run.route_failed", {
      error: error instanceof Error ? error.message : "Unknown route error"
    });

    return NextResponse.json(
      {
        error: "Watchlist execution failed.",
        ...safeSummary({ errorsCount: 1 })
      },
      { status: 500 }
    );
  }
}
