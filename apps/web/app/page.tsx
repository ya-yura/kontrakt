import { requireCurrentUser } from "@/src/auth/dev-auth";
import { getPrismaClient } from "@/src/lib/prisma";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function Home() {
  const prisma = getPrismaClient();
  const [currentUser, stages] = await Promise.all([
    requireCurrentUser(),
    prisma.kanbanStage.findMany({
      orderBy: { position: "asc" },
      select: {
        code: true,
        name: true,
        isTerminal: true
      }
    })
  ]);

  return (
    <main className="workspace-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">223-ФЗ MVP</p>
          <h1>Operational Workspace</h1>
        </div>
        <div className="user-chip" aria-label="Current user">
          <span>{currentUser.name}</span>
          <strong>{currentUser.email}</strong>
        </div>
      </header>

      <nav className="topbar-nav" aria-label="Workspace navigation">
        <Link href="/tenders">Tenders</Link>
        <Link href="/watchlists">Watchlists</Link>
      </nav>

      <section className="workspace-grid" aria-label="Workspace overview">
        <div className="summary-band">
          <p className="section-kicker">Protected shell</p>
          <h2>Текущий рабочий контур</h2>
          <dl className="summary-list">
            <div>
              <dt>Writer</dt>
              <dd>Next.js + Prisma</dd>
            </div>
            <div>
              <dt>Compute</dt>
              <dd>FastAPI stateless</dd>
            </div>
            <div>
              <dt>Auth</dt>
              <dd>Dev user</dd>
            </div>
          </dl>
        </div>

        <div className="kanban-band">
          <div className="section-heading">
            <p className="section-kicker">KanbanStage</p>
            <h2>Default pipeline</h2>
          </div>
          <ol className="stage-list" aria-label="Default Kanban stages">
            {stages.map((stage) => (
              <li key={stage.code} className="stage-item">
                <span>{stage.name}</span>
                <code>{stage.code}</code>
                {stage.isTerminal ? <small>terminal</small> : null}
              </li>
            ))}
          </ol>
        </div>
      </section>
    </main>
  );
}
