# CodeDuel

Ranked one-on-one Python coding duels. This repository currently contains the application and database foundation. Gameplay is tracked in [GOAL.md](GOAL.md).

## Local development

Requires Node.js 22.13+ (Node 24 recommended), npm, and Docker Compose for Postgres.

```powershell
npm ci
Copy-Item .env.example .env
docker compose up -d --wait
npm run db:migrate
npm run dev
```

Open http://localhost:3000. The supplied database credentials are for local development only. Alternatively, set `DATABASE_URL` in `.env` to your own Postgres instance. Never commit real credentials.

## Checks

```powershell
npm test
npm run lint
npm run typecheck
npm run build
```

Vitest tests the entry page in jsdom and executes the actual SQL migration in PGlite (embedded Postgres). Tests need neither Docker nor an external database and never execute player code. The judge and sandbox integration are future backlog items.

## Database

`db/migrations` contains ordered SQL migrations for users, problems, matches, submissions and rating history. `npm run db:migrate` applies pending migrations in one transaction, records them in `schema_migrations`, and uses a transaction advisory lock to serialize concurrent runs. Run it again safely after adding migrations; do not edit migrations already applied to a shared database.

Hidden tests, solutions, and submitted source are server-only data. No public database API is exposed. The schema records the median CPU time on large tests; the future judge must compute it over three runs. Authentication, participant authorization and match lifecycle enforcement belong to the future server implementation.

`docker compose down` stops the local database while preserving its volume.
