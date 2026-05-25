# Operational Workspace 223-FZ

Day 01 foundation for the MVP Operational Workspace for a supplier working with 223-FZ procurement.

## Structure

```text
apps/web      Next.js App Router, future system of record
apps/api      FastAPI stateless compute/adaptation service
docs/progress Daily progress logs and templates
```

PostgreSQL writes are reserved for the Next.js application via Prisma on Day 02. FastAPI is intentionally stateless and does not write business state.

## Local Development

1. Install dependencies:

   ```bash
   npm run install:all
   ```

2. Prepare local environment:

   ```bash
   cp .env.example .env
   ```

3. Start Postgres:

   ```bash
   npm run docker:up
   ```

   The database is exposed on `localhost:5439` to avoid conflicts with existing local PostgreSQL ports.

4. Start the web app:

   ```bash
   npm run dev:web
   ```

   Web health: `http://localhost:3000/api/healthz`

5. Start the API in a second terminal:

   ```bash
   npm run dev:api
   ```

   API health: `http://localhost:8000/healthz`

## Checks

```bash
npm run build
npm run typecheck
npm test
```

## Day 01 Scope Guard

- No real external source integration.
- No Prisma schema or migrations yet; only a placeholder directory is present for Day 02.
- No AI, OCR, Telegram, or email implementation.
- No real secrets in `.env.example`.
