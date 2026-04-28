# My Secretary

Personal NestJS backend that emails a daily meal plan at 06:00, generated from your fridge inventory, health profile, food preferences, and schedule, using the Claude Agent SDK.

## Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: NestJS 11
- **Package manager**: pnpm
- **Database**: PostgreSQL (TypeORM)
- **Scheduler**: `@nestjs/schedule` (cron)
- **Mail**: nodemailer (SMTP)
- **AI**: `@anthropic-ai/claude-agent-sdk`

## Architecture

Clean Architecture per domain module: `controller → service → domain → repository`.

```
src/
├── main.ts
├── app.module.ts
├── config/                     # Namespaced configs + env validation (class-validator)
├── infrastructure/             # External adapters
│   ├── database/               # TypeORM datasource + module
│   ├── mail/                   # Nodemailer transport
│   ├── claude/                 # Claude Agent SDK adapter
│   └── scheduler/              # @Cron jobs
└── modules/                    # Domain modules
    ├── user/
    ├── fridge/                 # Variable: ingredient state
    ├── health/                 # Variable: health profile
    ├── preference/             # Variable: food preferences
    ├── schedule/               # Variable: daily plan
    └── meal-plan/              # Generated meal plan + send flow
```

Each domain module uses the same layout:

```
modules/<name>/
├── <name>.module.ts
├── controller/
├── service/
├── domain/                     # Domain entities + repository interface (port)
└── repository/                 # TypeORM repository implementation + ORM entity
```

The `service` layer depends only on the repository **interface** in `domain/`. The TypeORM implementation is bound via Nest DI (`{ provide: TOKEN, useClass: ... }`).

Variable inputs (fridge, health, preference, schedule) are persisted as a single `data jsonb` column. The schema can be normalized later without changing the domain interfaces.

## Daily cron flow

```
06:00 (configurable via MEAL_PLAN_CRON)
  └─ DailyMealPlanJob
       └─ MealPlanService.generateAndSendDailyPlan(recipientEmail)
            ├─ UserService.findByEmail
            ├─ MealPlanGeneratorService.generate(userId, date)
            │     ├─ FridgeService.getLatest
            │     ├─ HealthService.getLatest
            │     ├─ PreferenceService.getLatest
            │     ├─ ScheduleService.getForDate
            │     └─ ClaudeService.run(prompt)
            ├─ MealPlanRepository.save
            └─ MailService.send
```

## Setup

```bash
# 1. Install
pnpm install

# 2. Configure env
cp .env.example .env
# Fill in DB credentials, ANTHROPIC_API_KEY, SMTP settings, MEAL_PLAN_RECIPIENT

# 3. Start Postgres (any way you prefer; example with Docker)
docker run -d --name my-secretary-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=my_secretary \
  -p 5432:5432 postgres:16

# 4. Generate + run migrations (after defining/changing entities)
pnpm migration:generate src/infrastructure/database/migrations/Init
pnpm migration:run

# 5. Run
pnpm start:dev
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm start:dev` | Run with watch mode |
| `pnpm build` | Compile to `dist/` |
| `pnpm start:prod` | Run compiled output |
| `pnpm lint` | ESLint --fix |
| `pnpm format` | Prettier |
| `pnpm test` | Unit tests |
| `pnpm test:e2e` | E2E tests |
| `pnpm migration:generate <path>` | Generate a new migration from entity diff |
| `pnpm migration:run` | Apply pending migrations |
| `pnpm migration:revert` | Revert the last migration |

## Environment variables

See `.env.example`. All variables are validated at boot via `class-validator` (see `src/config/env.validation.ts`); the app fails to start if anything required is missing or invalid.

## API (initial)

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/users/:id` | Look up a user |
| `GET` `PUT` | `/users/:userId/fridge` | Read / upsert fridge snapshot |
| `GET` `PUT` | `/users/:userId/health` | Read / upsert health profile |
| `GET` `PUT` | `/users/:userId/preferences` | Read / upsert preferences |
| `GET` `PUT` | `/users/:userId/schedule/:date` | Read / upsert schedule for a date |
| `GET` | `/users/:userId/meal-plans/:date` | Read a stored meal plan |
| `POST` | `/users/:userId/meal-plans/today/send` | Generate and send today's meal plan now |

## Notes

- `ClaudeService.run` is a stub. Wire it to `@anthropic-ai/claude-agent-sdk` in a follow-up step.
- Initial schema uses raw `jsonb` for variable inputs. Promote fields to columns once the data shape stabilizes.
- The cron expression and recipient email are read from env (`MEAL_PLAN_CRON`, `MEAL_PLAN_RECIPIENT`).
