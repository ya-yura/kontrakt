import type { NextRequest } from "next/server";
import { auth } from "@/src/auth/dev-auth";
import {
  createPrismaFileProxyStore,
  proxyDocumentFileForUser
} from "@/src/documents/file-proxy";
import { getPrismaClient } from "@/src/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type FileRouteContext = {
  params: Promise<{
    documentId: string;
  }>;
};

export async function GET(_request: NextRequest, { params }: FileRouteContext) {
  const user = await auth();

  if (!user?.id) {
    return Response.json(
      {
        error: "Unauthorized."
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "private, no-store",
          "X-Content-Type-Options": "nosniff"
        }
      }
    );
  }

  const { documentId } = await params;

  return proxyDocumentFileForUser({
    store: createPrismaFileProxyStore(getPrismaClient()),
    userId: user.id,
    documentId
  });
}
