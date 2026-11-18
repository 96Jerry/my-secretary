# My Secretary

개인 비서 역할을 하는 NestJS 백엔드. 일상의 반복 업무를 위임받아 수행하는 것을 목표로, 새로운 비서 업무를 도메인 모듈로 점진적으로 추가해 나간다.

## 비서 프레임워크

각 비서 업무는 다음 세 요소의 조합으로 구성된다:

```
[입력 어댑터]  →  [비서 업무 (job)]  →  [출력 채널]
```

| 요소                | 역할                                 | 현재 구현 / 향후 예시                                         |
| ------------------- | ------------------------------------ | ------------------------------------------------------------- |
| **입력 어댑터**     | 사용자/외부 데이터를 시스템에 들여옴 | Discord 자연어, REST 입력, 크롤러, 외부 API 등                |
| **비서 업무 (job)** | cron 또는 트리거에 반응해 작업 수행  | 식단 추천(AI), 동기부여(AI), 회사 식단표 크롤링, 웹툰 정렬 등 |
| **출력 채널**       | 결과를 사용자에게 전달               | Mail, Discord, …                                              |

비서 업무는 AI 호출에 한정되지 않는다. **단순 크롤링 + 알림**도 동등한 비서 업무로 취급한다.

## 현재 비서 업무

### 1. Meal Plan — 일일 식단

매일 아침, 냉장고 재고 / 건강 프로필 / 음식 선호도 / 일정 / 상황 / 최근 7일 식사 기록을 Claude에 전달해 오늘의 식단을 생성하고 메일로 발송한다.

### 2. Motivation — 동기부여

매일 아침, 사용자의 목표와 현재 상황을 바탕으로 Claude가 맞춤 동기부여 메시지를 생성해 메일로 발송한다.

### 3. Discord 인터페이스 (입력 + 트리거)

디스코드 봇이 사용자의 자연어 메시지를 받아 의도를 파싱해(`situation`, `meal-log` 등) 해당 도메인에 반영한다. 매일 22:00 cron으로 식사 기록과 내일 일정 입력을 요청한다.

### 향후 추가 예정 (예시)

- 회사 식단표 크롤러: 매일 사내 식단을 크롤링해 디스코드 / 메일로 안내
- 네이버 웹툰 좋아요 순 정렬: 공식에 없는 정렬을 크롤링으로 보강해 알림
- 그 외 일상에 도움되는 자동화 작업 자유롭게 추가

## 스택

- **런타임**: Node.js + TypeScript
- **프레임워크**: NestJS 11
- **패키지 매니저**: pnpm
- **데이터베이스**: PostgreSQL (TypeORM)
- **스케줄러**: `@nestjs/schedule` (cron)
- **메일**: nodemailer (SMTP)
- **챗 인터페이스**: Discord Bot
- **AI (선택)**: `@anthropic-ai/claude-agent-sdk`

## 아키텍처

도메인 모듈별 Clean Architecture: `controller → service → domain → repository`.

```
src/
├── main.ts
├── app.module.ts
├── config/                     # 네임스페이스별 설정 + 환경변수 검증 (class-validator)
├── infrastructure/             # 외부 어댑터 (입력 / 출력 / 외부 API)
│   ├── database/               # TypeORM 데이터소스 + 모듈
│   ├── mail/                   # Nodemailer 트랜스포트 (출력)
│   ├── discord/                # Discord 봇 + 의도 파서 (입력)
│   ├── claude/                 # Claude Agent SDK 어댑터 (AI 호출)
│   ├── logging/                # 로거 + 에러 알림
│   └── scheduler/              # @Cron 작업 (비서 업무 트리거)
└── modules/                    # 도메인 모듈
    ├── user/
    ├── fridge/                 # 입력: 냉장고 재고
    ├── health/                 # 입력: 건강 프로필
    ├── preference/             # 입력: 음식 선호도
    ├── schedule/               # 입력: 날짜별 일정
    ├── situation/              # 입력: 사용자 상황 / 컨디션
    ├── meal-log/               # 입력: 식사 기록
    ├── meal-plan/              # 비서 업무: 식단 생성 + 발송
    └── motivation/             # 비서 업무: 동기부여 메시지 생성 + 발송
```

각 도메인 모듈 레이아웃:

```
modules/<name>/
├── <name>.module.ts
├── controller/
├── service/
├── domain/                     # 도메인 엔티티 + 레포지토리 인터페이스 (포트), 프롬프트
└── repository/                 # TypeORM 레포지토리 구현 + ORM 엔티티
```

`service` 레이어는 `domain/`의 레포지토리 **인터페이스**에만 의존한다. TypeORM 구현체는 Nest DI로 바인딩한다 (`{ provide: TOKEN, useClass: ... }`).

가변 입력(fridge, health, preference, schedule 등)은 단일 `data jsonb` 컬럼으로 저장한다. 도메인 인터페이스를 바꾸지 않고도 추후 스키마를 정규화할 수 있다.

## 비서 업무 플로우

### 식단 발송 (매일 06:00, `MEAL_PLAN_CRON`)

```
DailyMealPlanJob
  └─ MealPlanService.generateAndSendDailyPlan(recipientEmail)
       ├─ UserService.findByEmail
       ├─ MealPlanGeneratorService.generate(userId, date)
       │     ├─ FridgeService.getLatest
       │     ├─ HealthService.getLatest
       │     ├─ PreferenceService.getLatest
       │     ├─ ScheduleService.getForDate
       │     ├─ SituationService.getLatest
       │     ├─ MealLogService.getRecent (최근 7일)
       │     └─ ClaudeService.run(prompt)
       ├─ MealPlanRepository.save
       └─ MailService.send
```

### 동기부여 메시지 발송 (매일 06:00, `MOTIVATION_CRON`)

```
DailyMotivationJob
  └─ MotivationService.composeAndSend
       ├─ MotivationProfileRepository.get (목표 + 상황)
       ├─ ClaudeService.run(compose-message prompt)
       ├─ MotivationMessageRepository.save
       └─ MailService.send
```

### 식단 발송 위한 정보 수집 (매일 22:00, `EVENING_COLLECTION_CRON`)

```
EveningCollectionJob
  └─ Discord 채널로 식사 기록 + 내일 일정 입력 요청
```

### 팰월드 패치노트 알림 (매일 09:00, `PALWORLD_NEWS_CRON`)

```
PalworldNewsJob
  └─ PalworldNewsService.checkForNewPosts
       ├─ SteamNewsService.fetchNews (Steam 뉴스 API)
       ├─ 개발사 공지(steam_community_announcements)만 필터 — 언론 기사 제외
       ├─ PalworldNewsRepository.isEmpty → 최초 기동이면 알림 없이 gid 저장만
       ├─ PalworldNewsRepository.findKnownGids (이미 알림 보낸 글 제외)
       ├─ MailService.send (새 글 제목 목록)
       └─ PalworldNewsRepository.saveGids (발송 성공 후 저장)
```

### CGV 용산 IMAX 신규 회차 알림 (10분마다, `CGV_IMAX_CRON`)

```
CgvImaxJob
  └─ CgvImaxService.checkForNewShowtimes
       ├─ 영화별 CgvScheduleService.fetchMovieDates (예매 가능 상영일자)
       │    └─ 목록에 날짜가 새로 생기는 것 = 그 영화의 예매 오픈 신호
       ├─ 가장 오래 확인하지 않은 (영화, 날짜) 1건 선택
       │    └─ 새로 생긴 날짜는 확인 이력이 없어 자동으로 맨 앞
       ├─ CgvScheduleService.fetchMovieShowtimes — 요청 간 3초 딜레이
       ├─ siteNo='0013' + tcscnsGradCd='03'(아이맥스)로 필터
       │    └─ 응답에는 같은 건물의 씨네드쉐프 용산(P013) 회차가 섞여 온다
       ├─ 메모리 캐시와 대조 (기동 후 첫 1회만 CgvImaxRepository.findAllKeys)
       ├─ 초기 동기화가 안 끝난 영화면 알림 없이 회차 키 저장만
       ├─ MailService.send (새 회차 목록 + 잔여 좌석수)
       └─ CgvImaxRepository.saveKeys (발송 성공 후 저장)
```

크론이 매번 같은 초에 나가지 않도록 주기마다 0~90초 지터를 준다.

사용하는 CGV API와 응답 필드, 함정은 [docs/cgv-api.md](docs/cgv-api.md)에 정리했다.

회차 키는 `극장번호:상영일:상영관번호:시작시각:영화번호`. 조회 전용이며 예매는
자동화하지 않는다. 새 회차가 없으면 DB를 건드리지 않는다 — 짧은 폴링 주기에서
Neon 컴퓨트 시간을 아끼기 위한 것.

감시 영화의 예매 가능 날짜는 한 자릿수라, 전체를 한 바퀴 도는 데 대략
`(날짜 수 / 2) * 폴링주기`가 걸린다. 이미 열린 날짜에 IMAX 회차가 나중에
배정되는 경우를 잡기 위해 확인이 끝난 날짜도 계속 돌려 본다.

주기마다 결과를 한 줄로 남긴다. 아무 일 없는 주기가 대부분이라, 이 줄이 없으면
'돌았는데 할 일이 없었다'와 '안 돌았다'를 나중에 구분할 수 없다.

```
CGV 크론 발화 — 지터 37초 대기
CGV 주기 완료 (3.1s) — 날짜 오디세이 7일(20260916~20260922) | 회차 오디세이 20260917 22건→IMAX 6건 | 신규 없음
CGV 예매 오픈 감지 — 오디세이: 20260923          # 날짜 목록에 없던 날짜가 생김
CGV 주기 중단 (0.4s) — 날짜조회: 오디세이 실패    # 앞선 warn에 사유가 남는다
```

`grep 'CGV 주기'`로 주기별 결과만, `grep 'CGV 크론 발화'`로 스케줄러가 돌았는지만
따로 볼 수 있다.

### 디스코드 메시지 처리 (입력 어댑터)

```
Discord 메시지 수신
  └─ IntentParserService.parse(자연어)
       └─ 의도별 도메인 서비스 호출 (situation, meal-log, schedule 등)
```

## 새 비서 업무 추가 가이드

1. **도메인 모듈 생성** — `src/modules/<name>/` 에 위 레이아웃 따라 생성
2. **트리거 정의**
   - 정기 실행이면 `src/infrastructure/scheduler/jobs/`에 cron job 추가
   - 디스코드 입력으로 트리거되면 `IntentParserService`에 의도 추가
   - 외부 데이터가 필요하면 `src/infrastructure/`에 입력 어댑터 추가 (크롤러, 외부 API 클라이언트 등)
3. **출력 채널 선택** — 기존 `MailService` 또는 Discord 채널 재사용
4. **AI 호출이 필요하면** `domain/prompts/`에 프롬프트 정의 후 `ClaudeService.run` 사용

레포 분리는 다음과 같이 정당화될 때만 고려: 무거운 런타임 의존성으로 부팅이 느려지는 경우, 장애 격리가 필요한 경우, 배포 주기가 완전히 다른 경우. 이 외에는 한 레포 안에서 모듈로 유지한다.

## 셋업

```bash
# 1. 설치
pnpm install

# 2. 환경변수 설정
cp .env.example .env
# DB 자격 증명, CLAUDE_CODE_OAUTH_TOKEN, SMTP 설정, MEAL_PLAN_RECIPIENT,
# DISCORD_BOT_TOKEN 등을 채운다
# 개발용은 DB_HOST=localhost, CRON_ENABLED=false, 개발용 봇 토큰, 수신자 +dev 주소로 둔다 (아래 배포 섹션 참고)

# 3. 개발 DB 실행 (docker-compose.override.yaml이 개발용 이름·포트로 덮어쓴다)
docker compose up -d db

# 4. 마이그레이션 생성 + 실행 (현재는 sync: true)
pnpm migration:generate src/infrastructure/database/migrations/Init
pnpm migration:run

# 5. 실행
pnpm start:dev
```

## 스크립트

| 명령어                           | 용도                                   |
| -------------------------------- | -------------------------------------- |
| `pnpm start:dev`                 | watch 모드로 실행                      |
| `pnpm build`                     | `dist/`로 컴파일                       |
| `pnpm start:prod`                | 컴파일된 결과물 실행                   |
| `pnpm lint`                      | ESLint --fix                           |
| `pnpm format`                    | Prettier                               |
| `pnpm test`                      | 유닛 테스트                            |
| `pnpm test:e2e`                  | E2E 테스트                             |
| `pnpm migration:generate <path>` | 엔티티 변경분으로 새 마이그레이션 생성 |
| `pnpm migration:run`             | 보류 중인 마이그레이션 적용            |
| `pnpm migration:revert`          | 마지막 마이그레이션 되돌리기           |

## 환경변수

`.env.example` 참고. 모든 변수는 부팅 시 `class-validator`로 검증된다 (`src/config/env.validation.ts`). 필수값이 없거나 유효하지 않으면 앱이 시작되지 않는다.

주요 cron 환경변수:

| 변수                      | 기본값       | 용도                       |
| ------------------------- | ------------ | -------------------------- |
| `MEAL_PLAN_CRON`          | `0 6 * * *`  | 식단 생성 + 발송           |
| `MOTIVATION_CRON`         | `0 6 * * *`  | 동기부여 메시지 발송       |
| `EVENING_COLLECTION_CRON` | `0 22 * * *` | 식사 기록 + 내일 일정 수집 |
| `PALWORLD_NEWS_CRON`      | `0 9 * * *`  | 팰월드 패치노트 폴링       |
| `CGV_IMAX_CRON`           | `*/10 * * * *` | CGV 용산 IMAX 신규 회차 폴링 |

## 배포

개발 기기(이 맥)가 운영 서버를 겸한다. `main`에 push하면 GitHub에서 테스트·이미지 빌드를 하고, 맥의 도커 위에서 도는 self-hosted runner가 새 이미지로 운영 컨테이너를 교체한다. 맥으로 들어오는 포트는 없다(러너가 GitHub로 나가는 연결만 쓴다).

```
┌──────────────── GitHub ────────────────┐
│ main에 push                             │
│  ├─ test   (GitHub VM, arm64)  pnpm test │
│  ├─ build  (GitHub VM, arm64)  이미지 빌드 → GHCR 푸시
│  │    ghcr.io/96jerry/my-secretary:latest / :<커밋 해시>
│  └─ deploy ─────────┐                   │
└─────────────────────┼───────────────────┘
          러너가 job을 받아감 (맥 → GitHub 방향 연결만)
┌──────────────── 이 맥 (Docker Desktop) ──────────────────────┐
│ [러너] runner-runner-1        ← ~/dev/my-secretary/deploy/runner │
│        도커 소켓으로 호스트 도커를 조작                          │
│ [운영] 프로젝트 my-secretary     ← ~/deploy/my-secretary        │
│        app 127.0.0.1:3000 / db 127.0.0.1:5432 (볼륨 my-secretary_pgdata)
│ [개발] 프로젝트 my-secretary-dev ← ~/dev/my-secretary           │
│        db 127.0.0.1:5433 (볼륨 my-secretary-dev_pgdata)        │
│        앱은 도커 밖에서 pnpm start:dev (127.0.0.1:3001)         │
└──────────────────────────────────────────────────────────────┘
```

### 배포 흐름 (`.github/workflows/deploy.production.yaml`)

1. **test** — GitHub의 arm64 VM에서 `pnpm test`. 실패하면 이후 단계는 실행되지 않는다.
2. **build** — 같은 VM에서 이미지를 빌드해 GHCR에 `latest`(배포용)와 커밋 해시(롤백용) 태그로 푸시한다. 이미지는 공개다. CI가 GitHub 소스로 빌드하므로 `.env`가 들어갈 수 없다.
3. **deploy** — 맥의 러너가 `~/deploy/my-secretary`에서 `docker compose pull app && docker compose up -d && docker image prune -f`를 실행한다. 토큰 권한은 없다(`permissions: {}`).

### 운영과 개발의 분리

같은 맥과 같은 도커를 쓰지만 폴더, compose 프로젝트 이름, 포트, `.env`, 디스코드 봇이 모두 다르다.

| | 운영 | 개발 |
| --- | --- | --- |
| 위치 | `~/deploy/my-secretary` | `~/dev/my-secretary` (git 저장소) |
| 폴더 구성 | `docker-compose.yaml` + `.env`만 | 소스 전체 + `docker-compose.override.yaml` |
| compose 프로젝트 이름 | `my-secretary` | `my-secretary-dev` |
| 앱 실행 | GHCR 이미지 컨테이너 | `pnpm start:dev` (도커 밖) |
| 앱 포트 | 127.0.0.1:3000 | 127.0.0.1:3001 (`PORT=3001`, `HOST=127.0.0.1`) |
| DB 포트 / 볼륨 | 127.0.0.1:5432 / `my-secretary_pgdata` | 127.0.0.1:5433 / `my-secretary-dev_pgdata` |
| Tailscale 주소 | `https://macmini.tail281653.ts.net` (+ `:8080` http) | `https://macmini.tail281653.ts.net:8443` (+ `:8081` http) |
| `DB_HOST` | `db` | `localhost` |
| 디스코드 봇 | 운영 봇 | 개발 봇 |
| 메일 수신자 | 원래 주소 | `아이디+dev@gmail.com` |
| cron | 켜짐 (`CRON_ENABLED` 기본값 `true`) | 꺼짐 (`CRON_ENABLED=false`) |

- `docker-compose.override.yaml`은 개발 폴더에만 있다. compose가 같은 폴더에 있으면 자동으로 합쳐 읽으므로 개발에서는 이름·포트가 바뀌고, 운영 폴더에는 이 파일이 없어 기본 설정대로 돈다.
- `.env`는 폴더마다 따로 있다. 운영 `.env`는 배포로 덮어써지지 않는다.
- 기본 포트(3000, 5432)는 운영이 쓰고 개발은 그 옆 번호를 쓴다.
- 운영·개발 모두 `127.0.0.1`에만 열고, 맥 밖에서는 `tailscale serve`를 거친 테일넷 주소로만 접근한다.
- 개발에서 cron을 끄는 이유: 켜 두면 운영과 중복 실행되어 메일·Claude 호출이 두 번 나가고, 특히 CGV 조회가 두 배가 되어 같은 IP가 차단되면 운영까지 막힌다.

### 러너 (`deploy/runner/`)

- GitHub 공식 러너를 담은 컨테이너(`myoung34/github-runner`)다. 호스트의 도커 소켓과 운영 폴더(같은 경로)를 마운트한다. 경로를 호스트와 똑같이 맞춰야 compose가 같은 프로젝트로 인식하고, 볼륨 경로도 호스트 기준으로 올바르게 해석된다.
- 최초 1회 등록: 저장소 Settings → Actions → Runners → New self-hosted runner 화면의 `--token` 값을 받아 1시간 안에 실행한다.
  ```bash
  cd deploy/runner
  RUNNER_TOKEN=<등록 토큰> docker compose up -d
  ```
  등록 정보는 `runner-data` 볼륨에 남아 이후에는 토큰 없이 재시작된다. GitHub에서 러너를 지웠거나 `docker compose down -v`로 볼륨을 지웠다면 새 토큰으로 다시 등록한다.
- 러너는 도커 전체 권한을 가진다. 워크플로는 `push` 트리거만 쓰고 `pull_request` 트리거를 추가하지 않는다(공개 저장소라 fork PR이 러너에서 코드를 실행할 수 있게 된다).

### 재부팅

맥 부팅 → 자동 로그인 → Docker Desktop 자동 시작 → `restart: unless-stopped`인 운영 app/db와 러너가 스스로 뜬다.

### 자주 쓰는 명령

| 할 일 | 방법 |
| --- | --- |
| 배포 | `main`에 push |
| 롤백 | `~/deploy/my-secretary`에서 `IMAGE_TAG=<커밋 해시> docker compose up -d`, 최신으로 복귀는 `docker compose up -d` |
| 운영 `.env` 수정 | `~/deploy/my-secretary/.env` 수정 후 그 폴더에서 `docker compose up -d` (push로는 반영되지 않음) |
| 운영 compose 수정 | 저장소의 `docker-compose.yaml`을 고친 뒤 `~/deploy/my-secretary`에 직접 복사 (deploy는 체크아웃하지 않음) |
| 개발 | `~/dev/my-secretary`에서 `docker compose up -d db` 후 `pnpm start:dev` |

## 메모

- 가변 입력 스키마는 raw `jsonb`로 시작한다. 데이터 형태가 안정화되면 컬럼으로 승격할 것.
- 단일 사용자, 단일 인스턴스 운영을 가정한다. 인증/락/재시도/마이그레이션 자동화는 필요해질 때 추가한다.
