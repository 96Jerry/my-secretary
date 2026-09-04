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

// 용산아이파크몰. searchRegnList로 확인한 값이며, 씨네드쉐프 용산(P013)과 다르다.
const YONGSAN_IPARK_SITE_NO = '0013';

// 특별관 등급 코드. 상영관명 문자열 매칭보다 안정적이다(리모델링 시 관 이름은 바뀜).
const IMAX_GRADE_CD = '03';

// CGV가 주는 날짜가 비정상적으로 늘어나도 요청이 폭주하지 않도록 상한을 둔다.
const MAX_DAYS = 30;

// 크롤링 예의: 날짜별 요청 사이 간격.
const REQUEST_DELAY_MS = 800;

// 평소 조회에서 볼 "아직 회차가 열리지 않은" 날짜 개수.
// 예매 오픈은 현재 열려 있는 구간 바로 다음 날짜부터 순서대로 생기므로,
// 매번 전체 날짜를 긁지 않아도 오픈 순간을 놓치지 않는다.
const FRONTIER_DAYS = 7;

// 이미 열린 날짜의 회차 증설은 평소 조회로는 안 잡히므로 주기적으로 전체를 훑는다.
const FULL_SWEEP_INTERVAL_MS = 30 * 60 * 1000;

// 메일 한 통에 담을 최대 회차 수.
const MAX_MAIL_ROWS = 50;

const BOOKING_URL = 'https://cgv.co.kr/cnm/movieBook/cinema';

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

  // 마지막 전체 조회 시각. 0이면 아직 한 번도 안 했다는 뜻이라 즉시 전체를 훑는다.
  private lastFullSweepAt = 0;

  constructor(
    @Inject(CGV_IMAX_REPOSITORY)
    private readonly showtimeRepo: CgvImaxRepository,
    private readonly cgvSchedule: CgvScheduleService,
    private readonly mailService: MailService,
    private readonly env: EnvironmentVariables,
  ) {}

  async checkForNewShowtimes(): Promise<void> {
    const watchList = parseWatchList(this.env.CGV_IMAX_MOVIES);
    if (watchList.length === 0) {
      this.logger.warn('CGV_IMAX_MOVIES가 비어 있어 감시를 건너뜁니다');
      return;
    }

    const known = await this.loadKnownKeys();

    const allDates = (
      await this.cgvSchedule.fetchScheduleDates(YONGSAN_IPARK_SITE_NO)
    ).slice(0, MAX_DAYS);
    if (allDates.length === 0) {
      this.logger.warn('CGV 상영일자가 0건 — 이번 주기는 건너뜁니다');
      return;
    }

    // 짧은 주기로 매번 전체를 긁으면 CGV에 과한 부하가 된다.
    const isFullSweep =
      Date.now() - this.lastFullSweepAt >= FULL_SWEEP_INTERVAL_MS;
    const dates = isFullSweep
      ? allDates
      : pickFrontier(allDates, known, FRONTIER_DAYS);
    if (dates.length === 0) return;

    let scannedRows = 0;
    const matched: CgvShowtime[] = [];
    for (const [index, scnYmd] of dates.entries()) {
      if (index > 0) await sleep(REQUEST_DELAY_MS);
      try {
        const rows = await this.cgvSchedule.fetchShowtimes(
          YONGSAN_IPARK_SITE_NO,
          scnYmd,
        );
        scannedRows += rows.length;
        matched.push(
          ...rows.filter(
            (row) =>
              row.tcscnsGradCd === IMAX_GRADE_CD &&
              matchesWatchList(row.movNm, watchList),
          ),
        );
      } catch (e) {
        // 하루치 실패로 전체를 중단하지 않는다. 키를 저장하지 않으므로
        // 다음 주기에 그 날짜가 자동으로 다시 조회된다.
        this.logger.warn(`CGV ${scnYmd} 조회 실패: ${(e as Error).message}`);
      }
    }

    if (isFullSweep) {
      this.lastFullSweepAt = Date.now();
      // 전체를 훑었는데 회차가 하나도 없으면 정상 상황이 아니다. error 레벨이라
      // DiscordWebhookLogger가 웹훅으로 알려준다.
      // (평소 조회는 아직 안 열린 날짜만 보므로 0건이 정상 — 여기서 판단하지 않는다.)
      if (scannedRows === 0) {
        this.logger.error(
          `CGV 상영회차가 ${dates.length}개 날짜 전부에서 0건 — API 변경 또는 차단 의심`,
        );
        return;
      }
    }

    const keyed: KeyedShowtime[] = matched.map((showtime) => ({
      key: toShowtimeKey(showtime),
      showtime,
    }));

    // 최초 기동: 이미 열려 있던 회차가 한꺼번에 발송되지 않도록 알림 없이 저장만 한다.
    if (known.size === 0) {
      await this.persist(keyed.map((item) => item.key));
      this.logger.log(`CGV IMAX 초기 동기화: ${keyed.length}건 저장`);
      return;
    }

    const fresh = keyed.filter((item) => !known.has(item.key));
    // 새 회차가 없으면 여기서 끝 — DB를 건드리지 않는다.
    if (fresh.length === 0) return;

    const titles = [...new Set(fresh.map((item) => item.showtime.movNm))];
    await this.mailService.send({
      to: this.env.CGV_IMAX_RECIPIENT,
      subject: `CGV 용산 IMAX 새 회차 ${fresh.length}건 — ${titles.join(', ')}`,
      html: toHtml(fresh.map((item) => item.showtime)),
    });

    // 발송에 성공한 뒤에 저장해야, 실패 시 다음 주기에 재시도된다.
    await this.persist(fresh.map((item) => item.key));

    this.logger.log(
      `CGV IMAX 새 회차 발송 완료: ${fresh.length}건 (${titles.join(', ')})`,
    );
  }

  /** 기동 후 첫 호출에서만 DB를 읽고, 이후로는 메모리 캐시를 재사용한다. */
  private async loadKnownKeys(): Promise<Set<string>> {
    if (this.knownKeys === null) {
      this.knownKeys = await this.showtimeRepo.findAllKeys();
      this.logger.log(`CGV IMAX 회차 캐시 적재: ${this.knownKeys.size}건`);
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

/**
 * 아직 감시 대상 회차를 본 적 없는 날짜를 가까운 순으로 고른다.
 * 새 예매가 열리는 지점이 정확히 여기다.
 */
function pickFrontier(
  dates: string[],
  known: Set<string>,
  limit: number,
): string[] {
  // 키는 '상영일:상영관:시작시각:영화번호' 형태라 앞 8자리가 상영일이다.
  const seen = new Set<string>();
  for (const key of known) seen.add(key.slice(0, 8));
  return dates.filter((date) => !seen.has(date)).slice(0, limit);
}

function toShowtimeKey(s: CgvShowtime): string {
  return `${s.scnYmd}:${s.scnsNo}:${s.scnsrtTm}:${s.movNo}`;
}

function parseWatchList(raw: string): string[] {
  return raw
    .split(',')
    .map(normalize)
    .filter((keyword) => keyword !== '');
}

function normalize(s: string): string {
  return s.replace(/\s+/g, '').toLowerCase();
}

// 제목 부분 일치. '오디세이'로 '오디세이(IMAX LASER 2D)' 같은 변형까지 잡는다.
function matchesWatchList(movNm: string, watchList: string[]): boolean {
  const title = normalize(movNm);
  return watchList.some((keyword) => title.includes(keyword));
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
      const when = `${formatDate(s.scnYmd)} ${formatTime(s.scnsrtTm)}`;
      const kind =
        s.movkndDsplNm !== '' ? ` · ${escapeHtml(s.movkndDsplNm)}` : '';
      const seats = `잔여 ${s.frSeatCnt}/${s.cpSeatCnt}석`;
      return `<li><b>${escapeHtml(s.movNm)}</b> — ${when} · ${escapeHtml(s.scnsNm)}${kind} · ${seats}</li>`;
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
