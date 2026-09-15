import { Inject, Injectable, Logger } from '@nestjs/common';
import { setTimeout as sleep } from 'node:timers/promises';

import { EnvironmentVariables } from '@config/index.js';
import {
  CgvScheduleService,
  CgvShowtime,
} from '@infra/cgv/cgv-schedule.service.js';
import { MailService } from '@infra/mail/mail.service.js';
import {
  CGV_IMAX_REPOSITORY,
  type CgvImaxRepository,
} from '../domain/cgv-imax.repository.js';

// 용산아이파크몰. 씨네드쉐프 용산(P013)과 다른 번호지만, 이 번호로 조회해도
// 응답에는 P013 회차가 섞여 온다 — 그래서 결과에서 다시 걸러야 한다.
const YONGSAN_IPARK_SITE_NO = '0013';

// 특별관 등급 코드. 상영관명 문자열 매칭보다 안정적이다(리모델링 시 관 이름은 바뀜).
const IMAX_GRADE_CD = '03';

// 한 주기에 보낼 회차 조회 수(감시 영화 전체 합산). 날짜 목록 조회는 영화당 1건이
// 따로 나가지만 응답이 작고 가볍다.
//
// 감시 후보는 '그 영화를 이 극장에서 예매할 수 있는 날짜'뿐이라 항상 한 자릿수다.
// 가장 오래 확인하지 않은 날짜부터 돌려 쓰므로, 7일치 기준 한 바퀴가 대략
// (7 / 2) * 폴링주기 만에 끝난다. 값을 올리면 한 바퀴가 빨라지는 대신
// 버스트가 커진다 — CGV는 일일 총량보다 짧은 시간의 연속 요청에 민감하다.
const SHOWTIME_LOOKUPS_PER_CYCLE = 2;

// 같은 주기에 여러 건을 조회할 때의 요청 간격.
const REQUEST_DELAY_MS = 3_000;

// 날짜 목록 조회가 이만큼 연속으로 실패하면 감시가 멈춘 것으로 보고 알린다.
const DEAD_CYCLES_BEFORE_ALERT = 3;

// 복구되지 않는 동안 같은 알림을 되풀이하는 간격(주기 수).
const DEAD_CYCLE_ALERT_INTERVAL = 18;

// 메일 한 통에 담을 최대 회차 수.
const MAX_MAIL_ROWS = 50;

const BOOKING_URL = 'https://cgv.co.kr/cnm/movieBook/cinema';

interface WatchedMovie {
  movNo: string;
  label: string; // 로그·메일 제목용. 지정하지 않으면 movNo를 그대로 쓴다
}

interface LookupTarget {
  movie: WatchedMovie;
  scnYmd: string;
}

interface KeyedShowtime {
  key: string;
  showtime: CgvShowtime;
}

@Injectable()
export class CgvImaxService {
  private readonly logger = new Logger(CgvImaxService.name);

  // 이미 알림을 보낸 회차 키를 메모리에 들고 있다가, 새 회차가 실제로 생겼을 때만
  // DB를 건드린다. Neon 컴퓨트는 쿼리 한 번에 autosuspend 시간만큼 깨어 있으므로,
  // 짧은 주기로 폴링하면서 매번 조회하면 컴퓨트 시간을 그대로 소진한다.
  // 단일 인스턴스(PM2 fork, instances: 1) 전제라 캐시 정합성 문제는 없다.
  private knownKeys: Set<string> | null = null;

  // 초기 동기화를 끝낸 영화. 여기 없는 영화는 회차를 찾아도 발송하지 않고 저장만 한다.
  private readonly bootstrapped = new Set<string>();

  // 영화별 예매 가능 상영일자. 매 주기 새로 받아 덮어쓴다.
  private readonly watchDates = new Map<string, string[]>();

  // 회차 조회를 '시도한' 시각. 순번을 정하는 데만 쓴다. 실패해도 갱신해서,
  // 계속 실패하는 날짜 하나가 다른 날짜의 차례를 빼앗지 않게 한다.
  private readonly lastAttemptAt = new Map<string, number>();

  // 회차 조회에 '성공한' 날짜. 초기 동기화 완료 판정은 이쪽을 본다 —
  // 시도만으로 판정하면 실패한 날짜의 기존 회차가 나중에 신규로 오탐된다.
  private readonly checkedDates = new Set<string>();

  // 날짜 목록 조회가 연속으로 실패한 주기 수. 이 조회는 매 주기 반드시 나가므로,
  // 값이 쌓인다는 것은 차단이나 스펙 변경으로 감시가 멈췄다는 뜻이다.
  // 개별 실패는 warn이라 디스코드까지 가지 않아, 일정 횟수부터 error로 올린다.
  private deadCycles = 0;

  constructor(
    @Inject(CGV_IMAX_REPOSITORY)
    private readonly showtimeRepo: CgvImaxRepository,
    private readonly cgvSchedule: CgvScheduleService,
    private readonly mailService: MailService,
    private readonly env: EnvironmentVariables,
  ) {}

  async checkForNewShowtimes(): Promise<void> {
    const movies = parseWatchList(this.env.CGV_IMAX_MOVIES, this.logger);
    if (movies.length === 0) {
      this.logger.warn('CGV_IMAX_MOVIES가 비어 있어 감시를 건너뜁니다');
      return;
    }

    const known = await this.loadState();

    // 1단계: 영화별 예매 가능 날짜. 목록에 날짜가 새로 생기는 것이 예매 오픈 신호다.
    const live = await this.refreshWatchDates(movies);
    this.trackReachability(live.length > 0);
    if (live.length === 0) return;

    // 2단계: 가장 오래 확인하지 않은 날짜부터 회차를 본다. 새로 생긴 날짜는
    // 확인 이력이 없으므로 자동으로 맨 앞에 선다.
    const found = await this.lookupShowtimes(this.pickTargets(live));

    const fresh = dedupeByKey(found).filter((item) => !known.has(item.key));
    // 초기 동기화가 끝나지 않은 영화의 회차는 조용히 저장만 한다.
    const notify = fresh.filter((item) =>
      this.bootstrapped.has(item.showtime.movNo),
    );

    if (notify.length > 0) {
      await this.sendMail(notify, movies);
    }
    // 발송에 성공한 뒤에 저장해야, 실패 시 다음 주기에 재시도된다.
    if (fresh.length > 0) {
      await this.persist(fresh.map((item) => item.key));
    }

    await this.markCompletedBootstraps(live);
  }

  /** 영화별 상영일자를 새로 받는다. 조회에 성공한 영화만 이번 주기의 대상이다. */
  private async refreshWatchDates(
    movies: WatchedMovie[],
  ): Promise<WatchedMovie[]> {
    const live: WatchedMovie[] = [];
    for (const [index, movie] of movies.entries()) {
      if (index > 0) await sleep(REQUEST_DELAY_MS);
      try {
        const dates = await this.cgvSchedule.fetchMovieDates(
          YONGSAN_IPARK_SITE_NO,
          movie.movNo,
        );
        this.watchDates.set(movie.movNo, dates);
        live.push(movie);
      } catch (e) {
        this.logger.warn(
          `CGV 상영일자 조회 실패 (${movie.label}): ${(e as Error).message}`,
        );
      }
    }
    return live;
  }

  /**
   * 감시 영화의 날짜 목록을 하나도 받지 못한 주기를 센다.
   * 한두 번은 일시적인 실패지만, 계속 이어지면 조용히 멈춘 것이므로 알린다.
   */
  private trackReachability(reachable: boolean): void {
    if (reachable) {
      if (this.deadCycles >= DEAD_CYCLES_BEFORE_ALERT) {
        this.logger.log(`CGV 조회 복구 — ${this.deadCycles}주기 만에 정상화`);
      }
      this.deadCycles = 0;
      return;
    }

    this.deadCycles += 1;
    if (
      this.deadCycles === DEAD_CYCLES_BEFORE_ALERT ||
      this.deadCycles % DEAD_CYCLE_ALERT_INTERVAL === 0
    ) {
      this.logger.error(
        `CGV 상영일자 조회가 ${this.deadCycles}주기 연속 실패 — IMAX 회차 감시가 멈춰 있습니다`,
      );
    }
  }

  /**
   * 이번 주기에 회차를 조회할 (영화, 날짜). 확인이 가장 오래된 순,
   * 같으면 가까운 날짜 순이다.
   */
  private pickTargets(live: WatchedMovie[]): LookupTarget[] {
    const candidates: LookupTarget[] = live.flatMap((movie) =>
      (this.watchDates.get(movie.movNo) ?? []).map((scnYmd) => ({
        movie,
        scnYmd,
      })),
    );

    return candidates
      .sort((a, b) => {
        const attemptedA = this.lastAttemptAt.get(toDateKey(a)) ?? 0;
        const attemptedB = this.lastAttemptAt.get(toDateKey(b)) ?? 0;
        return attemptedA - attemptedB || a.scnYmd.localeCompare(b.scnYmd);
      })
      .slice(0, SHOWTIME_LOOKUPS_PER_CYCLE);
  }

  private async lookupShowtimes(
    targets: LookupTarget[],
  ): Promise<CgvShowtime[]> {
    const found: CgvShowtime[] = [];
    for (const [index, target] of targets.entries()) {
      if (index > 0) await sleep(REQUEST_DELAY_MS);

      const dateKey = toDateKey(target);
      this.lastAttemptAt.set(dateKey, Date.now());
      try {
        const rows = await this.cgvSchedule.fetchMovieShowtimes(
          YONGSAN_IPARK_SITE_NO,
          target.movie.movNo,
          target.scnYmd,
        );
        this.checkedDates.add(dateKey);
        found.push(
          ...rows.filter(
            (row) =>
              row.siteNo === YONGSAN_IPARK_SITE_NO &&
              row.movNo === target.movie.movNo &&
              row.tcscnsGradCd === IMAX_GRADE_CD,
          ),
        );
      } catch (e) {
        // 하루치 실패로 전체를 중단하지 않는다. 다음 순번에 다시 조회된다.
        this.logger.warn(
          `CGV 회차 조회 실패 (${target.movie.label} ${target.scnYmd}): ${(e as Error).message}`,
        );
      }
    }
    return found;
  }

  private async sendMail(
    notify: KeyedShowtime[],
    movies: WatchedMovie[],
  ): Promise<void> {
    const labels = [
      ...new Set(
        notify.map(
          (item) =>
            movies.find((movie) => movie.movNo === item.showtime.movNo)
              ?.label ?? item.showtime.movNm,
        ),
      ),
    ];
    await this.mailService.send({
      to: this.env.CGV_IMAX_RECIPIENT,
      subject: `CGV 용산 IMAX 새 회차 ${notify.length}건 — ${labels.join(', ')}`,
      html: toHtml(notify.map((item) => item.showtime)),
    });
    this.logger.log(
      `CGV IMAX 새 회차 발송: ${notify.length}건 (${labels.join(', ')})`,
    );
  }

  /**
   * 현재 상영일자를 모두 한 번씩 훑은 영화를 초기 동기화 완료로 기록한다.
   * 예매가 아직 안 열린 영화는 날짜가 0건이므로 곧바로 완료된다 — 그래야
   * 나중에 처음 열리는 회차가 신규로 잡힌다.
   */
  private async markCompletedBootstraps(live: WatchedMovie[]): Promise<void> {
    for (const movie of live) {
      if (this.bootstrapped.has(movie.movNo)) continue;

      const dates = this.watchDates.get(movie.movNo) ?? [];
      const swept = dates.every((scnYmd) =>
        this.checkedDates.has(`${movie.movNo}:${scnYmd}`),
      );
      if (!swept) continue;

      await this.showtimeRepo.markBootstrapped(movie.movNo);
      this.bootstrapped.add(movie.movNo);
      this.logger.log(
        `CGV IMAX 초기 동기화 완료: ${movie.label} (상영일 ${dates.length}일)`,
      );
    }
  }

  /** 기동 후 첫 호출에서만 DB를 읽고, 이후로는 메모리 캐시를 재사용한다. */
  private async loadState(): Promise<Set<string>> {
    if (this.knownKeys === null) {
      const [keys, bootstrapped] = await Promise.all([
        this.showtimeRepo.findAllKeys(),
        this.showtimeRepo.findBootstrappedMovies(),
      ]);
      this.knownKeys = keys;
      bootstrapped.forEach((movNo) => this.bootstrapped.add(movNo));
      this.logger.log(
        `CGV IMAX 상태 적재: 회차 ${keys.size}건, 동기화된 영화 ${bootstrapped.size}편`,
      );
    }
    return this.knownKeys;
  }

  /** DB에 먼저 쓰고, 성공한 경우에만 캐시에 반영한다. */
  private async persist(keys: string[]): Promise<void> {
    await this.showtimeRepo.saveKeys(keys);
    const cache = this.knownKeys ?? new Set<string>();
    keys.forEach((key) => cache.add(key));
    this.knownKeys = cache;
  }
}

function toDateKey(target: LookupTarget): string {
  return `${target.movie.movNo}:${target.scnYmd}`;
}

function toShowtimeKey(s: CgvShowtime): string {
  return `${s.siteNo}:${s.scnYmd}:${s.scnsNo}:${s.scnsrtTm}:${s.movNo}`;
}

function dedupeByKey(showtimes: CgvShowtime[]): KeyedShowtime[] {
  const byKey = new Map<string, CgvShowtime>();
  for (const showtime of showtimes) {
    byKey.set(toShowtimeKey(showtime), showtime);
  }
  return [...byKey].map(([key, showtime]) => ({ key, showtime }));
}

/**
 * `라벨:영화번호` 또는 `영화번호`를 쉼표로 나열한다.
 * 예: '오디세이:30001323,30001999'
 *
 * 제목 문자열이 아니라 영화번호로 지정한다. 조회 API가 영화번호를 요구하고,
 * 제목은 상영 포맷에 따라 '오디세이(IMAX LASER 2D)'처럼 달라지기 때문이다.
 * 영화번호는 예매 페이지에서 영화를 고를 때 붙는 movNo 파라미터다.
 */
function parseWatchList(raw: string, logger: Logger): WatchedMovie[] {
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '')
    .map((entry) => {
      const separator = entry.lastIndexOf(':');
      const movNo = entry.slice(separator + 1).trim();
      const label = separator === -1 ? movNo : entry.slice(0, separator).trim();
      if (!/^\d+$/.test(movNo)) {
        logger.warn(
          `CGV_IMAX_MOVIES 항목을 건너뜁니다 (영화번호 아님): ${entry}`,
        );
        return null;
      }
      return { movNo, label: label === '' ? movNo : label };
    })
    .filter((movie): movie is WatchedMovie => movie !== null);
}

// scnsrtTm은 '2500'처럼 24를 넘을 수 있다(익일 01:00 상영).
function formatTime(hhmm: string): string {
  const hour = Number(hhmm.slice(0, 2));
  const minute = hhmm.slice(2, 4);
  if (!Number.isFinite(hour)) return hhmm;
  return hour >= 24
    ? `익일 ${pad(hour - 24)}:${minute}`
    : `${pad(hour)}:${minute}`;
}

function formatDate(scnYmd: string): string {
  return `${scnYmd.slice(0, 4)}-${scnYmd.slice(4, 6)}-${scnYmd.slice(6, 8)}`;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function toHtml(showtimes: CgvShowtime[]): string {
  const sorted = [...showtimes].sort((a, b) =>
    (a.scnYmd + a.scnsrtTm).localeCompare(b.scnYmd + b.scnsrtTm),
  );
  const shown = sorted.slice(0, MAX_MAIL_ROWS);

  const list = shown
    .map((s) => {
      // expoProdNm에는 상영 포맷이 포함돼 있다. 예: '오디세이(IMAX LASER 2D)'
      const title = s.expoProdNm !== '' ? s.expoProdNm : s.movNm;
      const when = `${formatDate(s.scnYmd)} ${formatTime(s.scnsrtTm)}`;
      const seats =
        s.frSeatCnt >= 0 && s.cpSeatCnt >= 0
          ? ` · 잔여 ${s.frSeatCnt}/${s.cpSeatCnt}석`
          : '';
      return (
        `<li><b>${escapeHtml(title)}</b> — ${when} · ` +
        `${escapeHtml(s.siteNm)} ${escapeHtml(s.scnsNm)}${seats}</li>`
      );
    })
    .join('');

  const omitted =
    sorted.length > shown.length
      ? `<p>외 ${sorted.length - shown.length}건</p>`
      : '';

  return (
    `<p>CGV 용산아이파크몰 IMAX에 새 회차가 열렸습니다.</p>` +
    `<ul>${list}</ul>${omitted}` +
    `<p><a href="${BOOKING_URL}">CGV 예매 페이지 열기</a></p>`
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
