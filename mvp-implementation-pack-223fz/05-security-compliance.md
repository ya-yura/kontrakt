# Security and compliance

## Auth and ownership

Все пользовательские действия должны проходить:

1. authentication;
2. input validation;
3. ownership check по `userId`;
4. idempotent write;
5. audit-friendly log.

Нельзя принимать `userId` от клиента как источник доверия. `userId` берется из session/auth context.

## Cron security

Все cron routes:

- принимают только `POST`;
- требуют `Authorization: Bearer ${CRON_SECRET}`;
- используют lock против параллельного запуска;
- имеют batch size и timeout;
- не возвращают чувствительные raw payload в response.

## File proxy

`GET /api/files/[documentId]`:

- проверяет session;
- проверяет, что document принадлежит tender текущего пользователя;
- не отдает произвольный `fileUrl`;
- не логирует signed URL;
- выставляет корректный content type.

## Telegram and Email

В уведомлениях отправлять только:

- номер закупки;
- заказчика;
- тип события;
- дедлайн;
- deep link в карточку.

Не отправлять:

- PDF-вложения;
- полные тексты документации;
- персональные данные сверх необходимого;
- AI raw response;
- private owner comments.

## Personal data note

Если продукт собирает персональные данные российских пользователей, primary database надо планировать в российском контуре. Перед production-запуском отдельно проверьте актуальные требования 152-ФЗ и договоры с провайдерами хостинга, email, OCR и LLM.

## Secrets

Минимальные env vars:

```text
DATABASE_URL=
DIRECT_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
CRON_SECRET=
FASTAPI_BASE_URL=
FASTAPI_INTERNAL_TOKEN=
EIS_PROVIDER_BASE_URL=
EIS_PROVIDER_API_KEY=
TELEGRAM_BOT_TOKEN=
EMAIL_PROVIDER_API_KEY=
OBJECT_STORAGE_ENDPOINT=
OBJECT_STORAGE_BUCKET=
OBJECT_STORAGE_ACCESS_KEY=
OBJECT_STORAGE_SECRET_KEY=
LLM_PROVIDER_API_KEY=
```

Правила:

- `.env` не коммитить;
- `.env.example` держать полным;
- secrets не передавать агентам в промптах;
- production secrets хранить в secret manager или настройках хостинга.

## Threat checklist

- User A не может открыть tender User B.
- Поддельный cron request не запускает batch.
- Повторный cron request не создает дубли.
- Telegram webhook валидируется.
- File proxy не превращается в SSRF.
- FastAPI не пишет в DB.
- AI prompt injection из PDF не может изменить системные правила анализа.
- Ошибка LLM не ломает карточку тендера.

