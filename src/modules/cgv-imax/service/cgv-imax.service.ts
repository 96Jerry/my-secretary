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

// 날짜 목록이 비정상적으로 길어져도 요청이 폭주하지 않도록 둔 상한.
// 실제로는 5주치(예매 가능 구간 + 아직 안 열린 날짜)가 온다.
const MAX_DAYS = 30;

// searchMovScnInfo는 연속 요청에 민감하다. 실측상 수 분 안에 10여 건이면 403이
// 떨어지고, 그 상태로 계속 두드리면 도메인 전체가 IP 단위로 차단된다.
// 일일 총량보다 '버스트'가 문제다.
//
// 감시 대상은 '회차가 아예 없던 날짜에 회차가 생기는 것'뿐이다. 이미 열린 날짜의
// 회차 증설은 보지 않으므로, 한 번 열린 것을 확인한 날짜는 openedDates에 적어두고
// 다시 묻지 않는다. 그래서 한 주기에 필요한 회차 조회는 '아직 안 열린 가장 가까운
// 날짜' 하나뿐이고, 예매 오픈은 정확히 거기서 일어난다.
// CGV가 순서대로 연다는 전제 — 먼 날짜를 건너뛰어 먼저 열면 그 앞 날짜들이
// 열린 뒤에야 잡힌다. 값을 올리면 그만큼 앞쪽을 넓게 본다.
const DATES_PER_CYCLE = 1;

// 위를 2 이상으로 올렸을 때만 쓰이는 요청 간격.
const REQUEST_DELAY_MS = 3_000;

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

  // 회차가 실제로 열린 것을 확인한 상영일자. '조회한' 날짜가 아니라 '열린' 날짜다 —
  // 조회만으로 빼면 아직 안 열린 날짜가 확인 완료로 처리돼 예매 오픈을 놓친다.
  // knownKeys로도 대신할 수 없다. 거기엔 감시 대상 회차만 담기므로, 회차가 다
  // 열려 있어도 감시 대상이 없는 날짜는 영원히 미확인으로 남아 매번 다시 긁힌다.
  private readonly openedDates = new Set<string>();

  // DB가 빈 상태로 기동했다면 이미 열려 있던 회차가 전부 '새 회차'로 보인다.
  // 한 주기에 한 건씩만 조회하므로 첫 한 바퀴는 여러 주기에 걸치고,
  // 그동안은 알림 없이 저장만 한다.
  private bootstrapping = false;

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

    const known = await this.loadState();

    const allDates = (
      await this.cgvSchedule.fetchScheduleDates(YONGSAN_IPARK_SITE_NO)
    ).slice(0, MAX_DAYS);
    if (allDates.length === 0) {
      this.logger.warn('CGV 상영일자가 0건 — 이번 주기는 건너뜁니다');
      return;
    }

    const dates = this.pickDates(allDates);
    if (dates.length === 0) return;

    const matched: CgvShowtime[] = [];
    const newlyOpened: string[] = [];
    // 회차가 안 열린 날짜에 닿았다는 뜻 — 그 앞은 전부 확인했다는 신호다.
    let reachedFrontier = false;
    for (const [index, scnYmd] of dates.entries()) {
      if (index > 0) await sleep(REQUEST_DELAY_MS);
      try {
        const rows = await this.cgvSchedule.fetchShowtimes(
          YONGSAN_IPARK_SITE_NO,
          scnYmd,
        );
        // pickDates는 아직 안 열린 날짜만 주므로 여기서 열림/미열림이 갈린다.
        if (rows.length > 0) {
          newlyOpened.push(scnYmd);
        } else {
          reachedFrontier = true;
        }
        matched.push(
          ...rows.filter(
            (row) =>
              row.tcscnsGradCd === IMAX_GRADE_CD &&
              matchesWatchList(row, watchList),
          ),
        );
      } catch (e) {
        // 하루치 실패로 전체를 중단하지 않는다. openedDates에 넣지 않으므로
        // 다음 주기에 그 날짜가 자동으로 다시 조회된다.
        this.logger.warn(`CGV ${scnYmd} 조회 실패: ${(e as Error).message}`);
      }
    }

    // 알림 발송보다 먼저 저장한다. 여기서 실패하면 다음 주기에 같은 날짜를 다시
    // 조회할 뿐이고, 반대로 발송만 되고 저장이 빠지면 같은 알림이 반복된다.
    if (newlyOpened.length > 0) {
      await this.showtimeRepo.saveOpenedDates(newlyOpened);
      newlyOpened.forEach((date) => this.openedDates.add(date));
      this.logger.log(`CGV 회차 오픈 확인: ${newlyOpened.join(', ')}`);
    }

    const keyed: KeyedShowtime[] = matched.map((showtime) => ({
      key: toShowtimeKey(showtime),
      showtime,
    }));

    // 부트스트랩 중에는 알림 없이 저장만 한다. 열린 날짜는 목록 앞쪽에 몰려 있으므로,
    // 아직 안 열린 날짜에 닿으면 그 앞은 전부 훑은 것이다.
    if (this.bootstrapping) {
      await this.persist(keyed.map((item) => item.key));
      if (reachedFrontier || allDates.every((d) => this.openedDates.has(d))) {
        this.bootstrapping = false;
        this.logger.log(
          `CGV IMAX 초기 동기화 완료: ${this.knownKeys?.size ?? 0}건`,
        );
      }
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

  /**
   * 이번 주기에 조회할 날짜. 아직 회차가 안 열린 가장 가까운 쪽부터 고른다.
   * 전부 열려 있으면 빈 배열 — 그 주기에는 회차 조회를 보내지 않는다.
   */
  private pickDates(allDates: string[]): string[] {
    return allDates
      .filter((date) => !this.openedDates.has(date))
      .slice(0, DATES_PER_CYCLE);
  }

  /** 기동 후 첫 호출에서만 DB를 읽고, 이후로는 메모리 캐시를 재사용한다. */
  private async loadState(): Promise<Set<string>> {
    if (this.knownKeys === null) {
      const [keys, opened] = await Promise.all([
        this.showtimeRepo.findAllKeys(),
        this.showtimeRepo.findOpenedDates(),
      ]);
      this.knownKeys = keys;
      opened.forEach((date) => this.openedDates.add(date));
      // 감시 대상 회차가 있는 날짜는 열린 날짜가 확실하다. 상영일 테이블이 비어 있는
      // 첫 배포에서 프런티어까지 하루씩 걸어가지 않도록 키에서도 채운다.
      // (키는 '상영일:상영관:시작시각:영화번호' 형태라 앞 8자리가 상영일이다.)
      keys.forEach((key) => this.openedDates.add(key.slice(0, 8)));
      this.bootstrapping = keys.size === 0;
      this.logger.log(
        `CGV IMAX 상태 적재: 회차 ${keys.size}건, 확인된 상영일 ${opened.size}건`,
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

/**
 * 제목 부분 일치. '오디세이'로 '오디세이(IMAX LASER 2D)' 같은 변형까지 잡는다.
 * 국문/영문 제목 양쪽을 보므로, 서버 터미널에서 한글 입력이 안 되는 환경에서는
 * 영문 제목('Odyssey')으로 지정해도 된다.
 */
function matchesWatchList(s: CgvShowtime, watchList: string[]): boolean {
  const titles = [normalize(s.movNm), normalize(s.movEnm)];
  return watchList.some((keyword) =>
    titles.some((title) => title !== '' && title.includes(keyword)),
  );
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
