import { NextResponse } from "next/server";
import { getWebHealth } from "@/src/health";

export function GET() {
  return NextResponse.json(getWebHealth());
}

