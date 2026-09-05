import { Injectable, Logger } from '@nestjs/common';

// CGV 프런트엔드(Next.js)가 사용하는 BFF. 백엔드(api.cgv.co.kr/cnm/atkt/*)는 Bearer
// 토큰을 요구하지만, BFF는 비로그인 공개 조회를 그대로 허용한다.
const BFF_BASE = 'https://cgv.co.kr/api/v1/booking';

// CGV 회사코드. 누락 시 400 "회사코드는 필수 값입니다".
const CO_CD = 'A420';

// 필수 파라미터지만 값 자체는 응답에 영향이 없다(01~05, A, B 모두 동일 응답).
const RTCTL_SCOP_CD = '01';

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
  scnYmd: string; // 상영일 YYYYMMDD
  scnsNo: string; // 상영관 번호 (용산 IMAX관 = 018)
  scnsNm: string; // 상영관명
  scnsrtTm: string; // 시작시각 HHmm. 심야는 '2500'처럼 24를 넘길 수 있다
  scnendTm: string;
  movNo: string; // 영화 번호
  movNm: string; // 영화 제목 (국문)
  movEnm: string; // 영화 제목 (영문). 거의 모든 상영작에 채워져 있다
  movkndDsplNm: string; // 예: 'IMAX LASER 2D'
  tcscnsGradCd: string; // 특별관 등급: 01 일반 / 02 4DX / 03 아이맥스 / 04 SCREENX
  frSeatCnt: number; // 잔여 좌석
  cpSeatCnt: number; // 총 좌석
}

@Injectable()
export class CgvScheduleService {
  private readonly logger = new Logger(CgvScheduleService.name);

  /**
   * 해당 극장에 스케줄이 존재하는 상영일자 목록(YYYYMMDD).
   * 아직 회차가 열리지 않은 날짜도 포함되므로, 날짜를 추측할 필요가 없다.
   */
  async fetchScheduleDates(siteNo: string): Promise<string[]> {
    const data = await this.getJson(
      `${BFF_BASE}/searchSiteScnscYmdListBySite?coCd=${CO_CD}&siteNo=${siteNo}`,
    );
    if (!Array.isArray(data)) {
      this.logger.warn('CGV 상영일자 응답 형태가 예상과 다름 — 빈 목록 반환');
      return [];
    }
    return data
      .map((row) => (row as { scnYmd?: unknown }).scnYmd)
      .filter((v): v is string => typeof v === 'string' && v.length === 8);
  }

  /**
   * 특정 날짜의 전체 상영회차. HTTP/스키마 실패는 throw —
   * 호출부에서 날짜 단위로 catch해 해당 날짜만 건너뛴다.
   */
  async fetchShowtimes(siteNo: string, scnYmd: string): Promise<CgvShowtime[]> {
    const data = await this.getJson(
      `${BFF_BASE}/searchMovScnInfo?coCd=${CO_CD}&siteNo=${siteNo}` +
        `&scnYmd=${scnYmd}&rtctlScopCd=${RTCTL_SCOP_CD}`,
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
      throw new Error(`CGV 응답 실패: ${res.status} ${res.statusText}`);
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

  const scnYmd = readString(row.scnYmd);
  const scnsNo = readString(row.scnsNo);
  const scnsrtTm = readString(row.scnsrtTm);
  const movNo = readString(row.movNo);
  // 이 넷은 회차 고유키를 이루므로 하나라도 없으면 중복 판단이 불가하다.
  if (!scnYmd || !scnsNo || !scnsrtTm || !movNo) return null;

  return {
    scnYmd,
    scnsNo,
    scnsNm: readString(row.scnsNm) ?? '',
    scnsrtTm,
    scnendTm: readString(row.scnendTm) ?? '',
    movNo,
    movNm: readString(row.movNm) ?? '(제목 없음)',
    movEnm: readString(row.movEnm) ?? '',
    movkndDsplNm: readString(row.movkndDsplNm) ?? '',
    tcscnsGradCd: readString(row.tcscnsGradCd) ?? '',
    frSeatCnt: readCount(row.frSeatCnt),
    cpSeatCnt: readCount(row.cpSeatCnt),
  };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value !== '' ? value : null;
}

// 좌석 수는 문자열('624')로 내려온다.
function readCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}
