import { NextResponse, type NextRequest } from "next/server";
import { validateCronAuthorization } from "@/src/watchlists/cron-auth";
import {
  AlertRunAlreadyInProgressError,
  emptyAlertRunSummary,
  runAlerts,
  type AlertRunSummary
} from "@/src/alerts/run-alerts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function safeSummary(overrides: Partial<AlertRunSummary> = {}): AlertRunSummary {
  return emptyAlertRunSummary(overrides);
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
    const summary = await runAlerts({ useLock: true });
    return NextResponse.json(summary);
  } catch (error) {
    if (error instanceof AlertRunAlreadyInProgressError) {
      return NextResponse.json(
        {
          error: "Alert execution is already running.",
          ...safeSummary({ errorsCount: 1 })
        },
        { status: 409 }
      );
    }

    console.error("alerts.run.route_failed", {
      error: error instanceof Error ? error.message : "Unknown route error"
    });

    return NextResponse.json(
      {
        error: "Alert execution failed.",
        ...safeSummary({ errorsCount: 1 })
      },
      { status: 500 }
    );
  }
}
