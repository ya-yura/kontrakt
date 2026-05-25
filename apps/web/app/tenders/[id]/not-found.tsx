import Link from "next/link";

export default function TenderCardNotFound() {
  return (
    <main className="workspace-shell">
      <section className="empty-state page-state" aria-label="Tender card not found">
        <h1>Закупка не найдена</h1>
        <p>
          Карточка недоступна: записи нет или она принадлежит другому пользователю. Для Sprint 01
          это означает, что ownership check сработал.
        </p>
        <Link className="secondary-link-button" href="/tenders">
          К списку закупок
        </Link>
      </section>
    </main>
  );
}
