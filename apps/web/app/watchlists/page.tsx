import Link from "next/link";
import { requireCurrentUser } from "@/src/auth/dev-auth";
import { getPrismaClient } from "@/src/lib/prisma";
import { toSavedFilterView } from "@/src/saved-filters/service";
import { WatchlistsClient } from "./watchlists-client";

export const dynamic = "force-dynamic";

export default async function WatchlistsPage() {
  const currentUser = await requireCurrentUser();
  const prisma = getPrismaClient();
  const savedFilters = await prisma.savedFilter.findMany({
    where: {
      userId: currentUser.id
    },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
    select: {
      id: true,
      userId: true,
      name: true,
      query: true,
      isActive: true,
      lastRunAt: true,
      lastCursor: true,
      lastResultCount: true,
      createdAt: true,
      updatedAt: true
    }
  });

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SavedFilter CRUD</p>
          <h1>Watchlists</h1>
        </div>
        <nav className="topbar-nav" aria-label="Workspace navigation">
          <Link href="/">Overview</Link>
          <Link href="/tenders">Tenders</Link>
        </nav>
      </header>

      <WatchlistsClient
        currentUserEmail={currentUser.email ?? "dev user"}
        initialFilters={savedFilters.map(toSavedFilterView)}
      />
    </main>
  );
}
