# My Secretary

매일 06:00에 식단을 생성해 이메일로 보내주는 개인용 NestJS 백엔드. 냉장고 재고, 건강 프로필, 음식 선호도, 일정을 바탕으로 Claude Agent SDK를 사용해 식단을 생성한다.

## 스택

- **런타임**: Node.js + TypeScript
- **프레임워크**: NestJS 11
- **패키지 매니저**: pnpm
- **데이터베이스**: PostgreSQL (TypeORM)
- **스케줄러**: `@nestjs/schedule` (cron)
- **메일**: nodemailer (SMTP)
- **AI**: `@anthropic-ai/claude-agent-sdk`

## 아키텍처

도메인 모듈별 Clean Architecture 구조: `controller → service → domain → repository`.

```
src/
├── main.ts
├── app.module.ts
├── config/                     # 네임스페이스별 설정 + 환경변수 검증 (class-validator)
├── infrastructure/             # 외부 어댑터
│   ├── database/               # TypeORM 데이터소스 + 모듈
│   ├── mail/                   # Nodemailer 트랜스포트
│   ├── claude/                 # Claude Agent SDK 어댑터
│   └── scheduler/              # @Cron 작업
└── modules/                    # 도메인 모듈
    ├── user/
    ├── fridge/                 # 가변 입력: 재료 상태
    ├── health/                 # 가변 입력: 건강 프로필
    ├── preference/             # 가변 입력: 음식 선호도
    ├── schedule/               # 가변 입력: 일정
    └── meal-plan/              # 생성된 식단 + 발송 플로우
```

각 도메인 모듈은 동일한 레이아웃을 따른다:

```
modules/<name>/
├── <name>.module.ts
├── controller/
├── service/
├── domain/                     # 도메인 엔티티 + 레포지토리 인터페이스 (포트)
└── repository/                 # TypeORM 레포지토리 구현 + ORM 엔티티
```

`service` 레이어는 `domain/`의 레포지토리 **인터페이스**에만 의존한다. TypeORM 구현체는 Nest DI로 바인딩한다 (`{ provide: TOKEN, useClass: ... }`).

가변 입력(fridge, health, preference, schedule)은 단일 `data jsonb` 컬럼으로 저장한다. 도메인 인터페이스를 바꾸지 않고도 추후 스키마를 정규화할 수 있다.

## 데일리 cron 플로우

```
06:00 (MEAL_PLAN_CRON으로 설정 가능)
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

## 셋업

```bash
# 1. 설치
pnpm install

# 2. 환경변수 설정
cp .env.example .env
# DB 자격 증명, ANTHROPIC_API_KEY, SMTP 설정, MEAL_PLAN_RECIPIENT 등을 채운다

# 3. Postgres 실행 (원하는 방식으로; Docker 예시)
docker run -d --name my-secretary-pg \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=my_secretary \
  -p 5432:5432 postgres:16

# 4. 마이그레이션 생성 + 실행 (엔티티 정의/변경 후)
pnpm migration:generate src/infrastructure/database/migrations/Init
pnpm migration:run

# 5. 실행
pnpm start:dev
```

## 스크립트

| 명령어 | 용도 |
|---|---|
| `pnpm start:dev` | watch 모드로 실행 |
| `pnpm build` | `dist/`로 컴파일 |
| `pnpm start:prod` | 컴파일된 결과물 실행 |
| `pnpm lint` | ESLint --fix |
| `pnpm format` | Prettier |
| `pnpm test` | 유닛 테스트 |
| `pnpm test:e2e` | E2E 테스트 |
| `pnpm migration:generate <path>` | 엔티티 변경분으로 새 마이그레이션 생성 |
| `pnpm migration:run` | 보류 중인 마이그레이션 적용 |
| `pnpm migration:revert` | 마지막 마이그레이션 되돌리기 |

## 환경변수

`.env.example` 참고. 모든 변수는 부팅 시 `class-validator`로 검증된다 (`src/config/env.validation.ts`). 필수값이 없거나 유효하지 않으면 앱이 시작되지 않는다.

## API (초기)

| Method | Path | 용도 |
|---|---|---|
| `GET` | `/users/:id` | 사용자 조회 |
| `GET` `PUT` | `/users/:userId/fridge` | 냉장고 스냅샷 조회 / upsert |
| `GET` `PUT` | `/users/:userId/health` | 건강 프로필 조회 / upsert |
| `GET` `PUT` | `/users/:userId/preferences` | 선호도 조회 / upsert |
| `GET` `PUT` | `/users/:userId/schedule/:date` | 특정 날짜 일정 조회 / upsert |
| `GET` | `/users/:userId/meal-plans/:date` | 저장된 식단 조회 |
| `POST` | `/users/:userId/meal-plans/today/send` | 오늘 식단을 즉시 생성 후 발송 |

## 메모

- `ClaudeService.run`은 스텁이다. 후속 작업에서 `@anthropic-ai/claude-agent-sdk`에 연결할 것.
- 초기 스키마는 가변 입력에 raw `jsonb`를 사용한다. 데이터 형태가 안정화되면 컬럼으로 승격할 것.
- cron 표현식과 수신자 이메일은 환경변수에서 읽는다 (`MEAL_PLAN_CRON`, `MEAL_PLAN_RECIPIENT`).
