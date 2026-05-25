export default function TenderCardLoading() {
  return (
    <main className="workspace-shell">
      <header className="topbar tender-card-topbar">
        <div>
          <p className="eyebrow">Tender card</p>
          <h1>Загрузка закупки...</h1>
        </div>
      </header>
      <section className="tender-hero tender-skeleton" aria-label="Loading tender card">
        <div />
        <div />
      </section>
      <div className="tender-card-grid">
        <section className="tender-section tender-skeleton" />
        <section className="tender-section tender-skeleton" />
      </div>
    </main>
  );
}
