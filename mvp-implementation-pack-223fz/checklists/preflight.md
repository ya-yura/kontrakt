# Preflight checklist

Выполнить до старта разработки.

## Product

- [ ] Подтверждены границы MVP.
- [ ] Есть список 10-20 контрольных закупок или fixture dataset.
- [ ] Понятно, какие поставщики/ниши проверяются первыми.
- [ ] Определены hard blockers для компании пользователя.
- [ ] Определены минимальные alert preferences.

## Technical

- [ ] Выбран hosting для Next.js.
- [ ] Выбран hosting для FastAPI.
- [ ] Выбран PostgreSQL provider.
- [ ] Проверено, где будет primary DB для персональных данных.
- [ ] Выбран object storage для документов.
- [ ] Выбран email provider.
- [ ] Создан Telegram bot для staging или решено отложить Telegram.
- [ ] Есть стратегия для внешнего 223-ФЗ источника и API key, если нужен.

## Development

- [ ] Создан репозиторий.
- [ ] Настроен `.env.example`.
- [ ] Настроен local Postgres.
- [ ] Настроены базовые проверки: lint, typecheck, tests.
- [ ] Согласован branch/PR flow.
- [ ] Подготовлены AI agent prompts.

## Risk decisions

- [ ] Принято: FastAPI не пишет в БД.
- [ ] Принято: scoring v1 rule-based.
- [ ] Принято: AI extractive only.
- [ ] Принято: source stage и kanban stage разделены.
- [ ] Принято: alerts не real-time stream, а scheduled checks.

