"use client";

export default function TenderCardError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="workspace-shell">
      <section className="empty-state page-state" aria-label="Tender card error">
        <h1>Не удалось открыть карточку</h1>
        <p>Данные закупки временно недоступны. Можно повторить загрузку или вернуться к списку.</p>
        <div className="filter-actions">
          <button type="button" className="primary-button" onClick={reset}>
            Повторить
          </button>
          <a className="secondary-link-button" href="/tenders">
            К списку закупок
          </a>
        </div>
      </section>
    </main>
  );
}
