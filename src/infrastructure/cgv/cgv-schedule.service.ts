import { Injectable, Logger } from '@nestjs/common';

// CGV 프런트엔드(Next.js)가 사용하는 BFF. 백엔드(api.cgv.co.kr/cnm/atkt/*)는 Bearer
// 토큰을 요구하지만, BFF는 비로그인 공개 조회를 그대로 허용한다.
const BFF_BASE = 'https://cgv.co.kr/api/v1/booking';

// CGV 회사코드. 누락 시 400 "회사코드는 필수 값입니다".
const CO_CD = 'A420';

// searchSchByMov의 조회범위 코드. 영화 우선 예매 화면이 보내는 값을 그대로 쓴다.
const RTCTL_SCOP_CD = '08';

// 봇임을 숨기지 않고 밝힌다. 이 UA로 정상 응답이 오므로 우회가 아니다.
// cgv.co.kr은 Cloudflare 뒤에 있고, UA가 아예 없으면 403 + HTML 에러페이지가
// 온다. Referer는 없어도 200이지만 출처를 밝히는 의미로 함께 보낸다.
const HEADERS: Record<string, string> = {
  'User-Agent': 'my-secretary-bot/1.0 (personal showtime notifier)',
  Accept: 'application/json',
  'Accept-Language': 'ko-KR',
  Referer: 'https://cgv.co.kr/',
};

const REQUEST_TIMEOUT_MS = 10_000;

export interface CgvShowtime {
  siteNo: string; // 극장 번호. 요청한 siteNo와 다를 수 있다 — fetchMovieShowtimes 주석 참고
  siteNm: string; // 극장명
  scnYmd: string; // 상영일 YYYYMMDD
  scnsNo: string; // 상영관 번호. 극장 안에서만 유일하다 (용산 IMAX관 = 018)
  scnsNm: string; // 상영관명
  scnsrtTm: string; // 시작시각 HHmm. 심야는 '2500'처럼 24를 넘길 수 있다
  scnendTm: string;
  movNo: string; // 영화 번호
  movNm: string; // 영화 제목 (국문). 상영 포맷이 빠진 원제목이다
  expoProdNm: string; // 노출용 상품명. 예: '오디세이(IMAX LASER 2D)'
  movkndDsplNm: string; // 예: 'IMAX LASER 2D'
  tcscnsGradCd: string; // 특별관 등급: 01 일반 / 02 4DX / 03 아이맥스 / 04 SCREENX
  frSeatCnt: number; // 잔여 좌석. 값이 없으면 -1
  cpSeatCnt: number; // 총 좌석. 값이 없으면 -1
}

@Injectable()
export class CgvScheduleService {
  private readonly logger = new Logger(CgvScheduleService.name);

  /**
   * 해당 극장에서 그 영화를 예매할 수 있는 상영일자 목록(YYYYMMDD, 오름차순).
   *
   * 극장 전용 목록(searchSiteScnscYmdListBySite)과 달리 과거 날짜가 섞이지 않고,
   * 아직 예매가 열리지 않았으면 빈 배열이 온다. 그래서 '목록에 날짜가 새로 생기는
   * 것' 자체가 그 영화의 예매 오픈 신호가 된다.
   */
  async fetchMovieDates(siteNo: string, movNo: string): Promise<string[]> {
    const data = await this.getJson(
      `${BFF_BASE}/searchSiteScnscYmdListByMov` +
        `?coCd=${CO_CD}&siteNo=${siteNo}&movNo=${movNo}`,
    );
    if (!Array.isArray(data)) {
      this.logger.warn(`CGV 상영일자 응답 형태가 예상과 다름: movNo=${movNo}`);
      return [];
    }

    // 과거가 섞여 오지 않는 것을 확인했지만, 섞이는 순간 '가까운 날짜부터' 정렬이
    // 과거를 가리키게 되므로 방어적으로 잘라낸다.
    const today = todayYmdKst();
    return data
      .map((row) => (row as { scnYmd?: unknown }).scnYmd)
      .filter((v): v is string => typeof v === 'string' && v.length === 8)
      .filter((scnYmd) => scnYmd >= today)
      .sort();
  }

  /**
   * 특정 극장·날짜의 그 영화 상영회차. HTTP/스키마 실패는 throw —
   * 호출부에서 날짜 단위로 catch해 해당 날짜만 건너뛴다.
   *
   * 주의: siteNo=0013(용산아이파크몰)으로 물어도 응답에 siteNo=P013(씨네드쉐프
   * 용산) 회차가 함께 온다. siteNo는 단일 극장이 아니라 같은 건물의 묶음으로
   * 동작하므로, 호출부에서 siteNo를 반드시 다시 걸러야 한다.
   */
  async fetchMovieShowtimes(
    siteNo: string,
    movNo: string,
    scnYmd: string,
  ): Promise<CgvShowtime[]> {
    const data = await this.getJson(
      `${BFF_BASE}/searchSchByMov?coCd=${CO_CD}&siteNo=${siteNo}` +
        `&scnYmd=${scnYmd}&movNo=${movNo}&rtctlScopCd=${RTCTL_SCOP_CD}`,
    );
    if (!Array.isArray(data)) {
      this.logger.warn(`CGV 상영정보 응답 형태가 예상과 다름: ${scnYmd}`);
      return [];
    }
    return data.map(toShowtime).filter((s): s is CgvShowtime => s !== null);
  }

  private async getJson(url: string): Promise<unknown> {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
    if (!res.ok) {
      throw new Error(`CGV 응답 실패: ${describeStatus(res)}`);
    }
    // 차단당하면 200이 아니라 403 + HTML이 온다. json() 전에 반드시 확인해야
    // "Unexpected token '<'" 대신 원인이 드러나는 메시지가 남는다.
    const contentType = res.headers.get('content-type') ?? '';
    if (!contentType.includes('json')) {
      throw new Error(
        `CGV가 JSON이 아닌 응답 반환 (${contentType}) — 차단 의심`,
      );
    }

    const body = (await res.json()) as { statusCode?: unknown; data?: unknown };
    if (String(body.statusCode) !== '0') {
      throw new Error(`CGV statusCode=${String(body.statusCode)}`);
    }
    return body.data;
  }
}

function toShowtime(entry: unknown): CgvShowtime | null {
  if (typeof entry !== 'object' || entry === null) return null;
  const row = entry as Record<string, unknown>;

  const siteNo = readString(row.siteNo);
  const scnYmd = readString(row.scnYmd);
  const scnsNo = readString(row.scnsNo);
  const scnsrtTm = readString(row.scnsrtTm);
  const movNo = readString(row.movNo);
  // 이 다섯이 회차 고유키를 이루므로 하나라도 없으면 중복 판단이 불가하다.
  // scnsNo는 극장 안에서만 유일해서 siteNo가 빠지면 극장 간 충돌이 난다.
  if (!siteNo || !scnYmd || !scnsNo || !scnsrtTm || !movNo) return null;

  return {
    siteNo,
    siteNm: readString(row.siteNm) ?? '',
    scnYmd,
    scnsNo,
    scnsNm: readString(row.scnsNm) ?? '',
    scnsrtTm,
    scnendTm: readString(row.scnendTm) ?? '',
    movNo,
    movNm: readString(row.movNm) ?? '(제목 없음)',
    expoProdNm: readString(row.expoProdNm) ?? '',
    movkndDsplNm: readString(row.movkndDsplNm) ?? '',
    tcscnsGradCd: readString(row.tcscnsGradCd) ?? '',
    frSeatCnt: readCount(row.frSeatCnt),
    cpSeatCnt: readCount(row.cpSeatCnt),
  };
}

// HTTP/2에는 reason phrase가 없어 statusText가 빈 문자열로 온다.
function describeStatus(res: Response): string {
  return res.statusText === ''
    ? String(res.status)
    : `${res.status} ${res.statusText}`;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

// 좌석 수는 문자열('624')로 내려온다. 0을 기본값으로 쓰면 매진과 구분되지 않으므로
// 파싱 실패는 -1로 두고 표시 단계에서 숨긴다.
function readCount(value: unknown): number {
  if (typeof value !== 'string' && typeof value !== 'number') return -1;
  const n = Number(value);
  return Number.isFinite(n) ? n : -1;
}

// CGV 상영일자는 한국 날짜 기준이다. 서버 타임존에 의존하면 자정 전후로 하루가 밀린다.
function todayYmdKst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
    .format(new Date())
    .replaceAll('-', '');
}
