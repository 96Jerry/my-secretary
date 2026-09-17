import { Logger } from '@nestjs/common';

// 요청 사이 지연은 CGV에 대한 예의이지 검증 대상이 아니다. 테스트에서는 건너뛴다.
// 가짜 타이머는 node:timers/promises에 닿지 않으므로 모듈째 대체한다.
jest.mock('node:timers/promises', () => ({
  setTimeout: (): Promise<void> => Promise.resolve(),
}));

import type { EnvironmentVariables } from '@config/index.js';
import { CgvScheduleService } from '@infra/cgv/cgv-schedule.service.js';
import type { MailService, SendMailOptions } from '@infra/mail/mail.service.js';
import type { CgvImaxRepository } from '../domain/cgv-imax.repository.js';
import { CgvImaxService } from './cgv-imax.service.js';

const SITE_NO = '0013';
const MOV_NO = '30001323';

/** CGV 응답 한 행. 실제 searchSchByMov 응답에서 쓰는 필드만 추렸다. */
interface RowOverrides {
  siteNo?: string;
  siteNm?: string;
  scnsNo?: string;
  scnsNm?: string;
  scnYmd?: string;
  scnsrtTm?: string;
  tcscnsGradCd?: string;
  movNo?: string;
  frSeatCnt?: string;
}

function toUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string') return input;
  return input instanceof URL ? input.href : input.url;
}

function row(overrides: RowOverrides = {}): Record<string, string> {
  return {
    siteNo: SITE_NO,
    siteNm: 'CGV 용산아이파크몰',
    scnsNo: '018',
    scnsNm: 'IMAX관',
    scnYmd: '20260917',
    scnsrtTm: '0730',
    scnendTm: '1032',
    tcscnsGradCd: '03', // 아이맥스
    movNo: MOV_NO,
    movNm: '오디세이',
    movEnm: 'The Odyssey',
    expoProdNm: '오디세이(IMAX LASER 2D)',
    movkndDsplNm: 'IMAX LASER 2D',
    cpSeatCnt: '624',
    frSeatCnt: '21',
    ...overrides,
  };
}

/**
 * CGV BFF 대역. 실제 CgvScheduleService를 그대로 통과시키므로 URL 조립과
 * 응답 파싱까지 함께 검증된다.
 */
class FakeCgv {
  dates: string[] = [];
  rowsByDate = new Map<string, Record<string, string>[]>();
  status = 200;
  readonly urls: string[] = [];

  install(): void {
    globalThis.fetch = (input: RequestInfo | URL): Promise<Response> =>
      Promise.resolve(this.respond(toUrl(input)));
  }

  private respond(url: string): Response {
    this.urls.push(url);
    if (this.status !== 200) {
      return new Response('<!DOCTYPE html>', {
        status: this.status,
        headers: { 'content-type': 'text/html' },
      });
    }

    const target = new URL(url);
    const data = target.pathname.endsWith('/searchSiteScnscYmdListByMov')
      ? this.dates.map((scnYmd) => ({ scnYmd, hldyYn: null }))
      : (this.rowsByDate.get(target.searchParams.get('scnYmd') ?? '') ?? []);
    return new Response(
      JSON.stringify({ statusCode: 0, statusMessage: 'ok', data }),
      { headers: { 'content-type': 'application/json;charset=UTF-8' } },
    );
  }
}

class FakeRepository implements CgvImaxRepository {
  readonly keys = new Set<string>();
  readonly bootstrapped = new Set<string>();

  findAllKeys(): Promise<Set<string>> {
    return Promise.resolve(new Set(this.keys));
  }
  saveKeys(keys: string[]): Promise<void> {
    keys.forEach((key) => this.keys.add(key));
    return Promise.resolve();
  }
  findBootstrappedMovies(): Promise<Set<string>> {
    return Promise.resolve(new Set(this.bootstrapped));
  }
  markBootstrapped(movNo: string): Promise<void> {
    this.bootstrapped.add(movNo);
    return Promise.resolve();
  }
}

describe('CgvImaxService', () => {
  let cgv: FakeCgv;
  let repo: FakeRepository;
  let mails: SendMailOptions[];
  let service: CgvImaxService;
  let realFetch: typeof globalThis.fetch;

  /** 감시 날짜를 한 바퀴 다 돌 만큼 주기를 반복한다. */
  const runCycles = async (count: number): Promise<void> => {
    for (let i = 0; i < count; i++) {
      await service.checkForNewShowtimes();
    }
  };

  beforeEach(() => {
    realFetch = globalThis.fetch;
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    cgv = new FakeCgv();
    cgv.install();
    repo = new FakeRepository();
    mails = [];

    service = new CgvImaxService(
      repo,
      new CgvScheduleService(),
      {
        send: (options: SendMailOptions) => {
          mails.push(options);
          return Promise.resolve();
        },
      } as MailService,
      {
        CGV_IMAX_MOVIES: `오디세이:${MOV_NO}`,
        CGV_IMAX_RECIPIENT: 'me@example.com',
      } as EnvironmentVariables,
    );
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
    jest.restoreAllMocks();
  });

  describe('초기 동기화', () => {
    it('첫 한 바퀴는 알림 없이 회차만 저장한다', async () => {
      cgv.dates = ['20260917'];
      cgv.rowsByDate.set('20260917', [row(), row({ scnsrtTm: '1100' })]);

      await runCycles(1);

      expect(mails).toHaveLength(0);
      expect(repo.keys.size).toBe(2);
      expect(repo.bootstrapped.has(MOV_NO)).toBe(true);
    });

    it('초기 동기화가 끝난 뒤에 생긴 회차만 발송한다', async () => {
      cgv.dates = ['20260917'];
      cgv.rowsByDate.set('20260917', [row()]);
      await runCycles(1); // 초기 동기화

      cgv.rowsByDate.set('20260917', [row(), row({ scnsrtTm: '1800' })]);
      await runCycles(1);

      expect(mails).toHaveLength(1);
      expect(mails[0].subject).toContain('1건');
      expect(mails[0].subject).toContain('오디세이');
    });
  });

  describe('극장 필터', () => {
    // siteNo=0013으로 물어도 같은 건물의 씨네드쉐프 용산(P013) 회차가 함께 온다.
    // scnsNo는 극장 안에서만 유일하므로, 극장번호가 키에 없으면 상영관·시각이
    // 겹치는 두 회차가 같은 키가 되어 한쪽이 영영 알림에서 누락된다.
    it('다른 극장의 회차를 걸러내고 키가 충돌하지 않는다', async () => {
      cgv.dates = ['20260917'];
      cgv.rowsByDate.set('20260917', [
        row(),
        row({ siteNo: 'P013', siteNm: '씨네드쉐프 용산' }), // 상영관·시각 동일
      ]);

      await runCycles(1);

      expect(repo.keys.size).toBe(1);
      expect([...repo.keys]).toEqual([`0013:20260917:018:0730:${MOV_NO}`]);
    });

    it.todo('IMAX가 아닌 회차(tcscnsGradCd !== 03)는 무시한다');
  });

  describe('예매 오픈 감지', () => {
    it.todo('날짜 목록에 없던 날짜가 생기면 다음 주기에 회차를 조회한다');
    it.todo('예매 전(날짜 0건)이어도 초기 동기화를 완료 처리한다');
    // 날짜 목록은 같은 건물의 씨네드쉐프 회차만 있어도 날짜를 내준다. 그 날짜는
    // IMAX 0건으로 확인이 끝나 순번이 뒤로 밀리므로, 나중에 배정된 IMAX가
    // 날짜 한 바퀴를 다 돌 때까지 늦게 잡히던 문제.
    it('IMAX 없이 열린 날짜에 IMAX가 배정되면 한 바퀴를 기다리지 않고 잡는다', async () => {
      const imaxDays = ['20991201', '20991202', '20991203', '20991204'];
      const lateDay = '20991205';
      cgv.dates = [...imaxDays, lateDay];
      for (const scnYmd of imaxDays) {
        cgv.rowsByDate.set(scnYmd, [row({ scnYmd })]);
      }
      cgv.rowsByDate.set(lateDay, [
        row({
          scnYmd: lateDay,
          siteNo: 'P013',
          scnsNo: '002',
          tcscnsGradCd: '01',
        }),
      ]);
      await runCycles(5); // 초기 동기화
      expect(repo.bootstrapped.has(MOV_NO)).toBe(true);
      expect(mails).toHaveLength(0);

      cgv.rowsByDate.set(lateDay, [row({ scnYmd: lateDay })]);
      await runCycles(2);

      expect(mails).toHaveLength(1);
      expect(repo.keys.has(`0013:${lateDay}:018:0730:${MOV_NO}`)).toBe(true);
    });
  });

  describe('중복 발송', () => {
    it.todo('이미 알린 회차는 다시 보내지 않는다');
    it.todo('잔여 좌석만 바뀐 회차는 신규로 보지 않는다');
  });

  describe('실패 처리', () => {
    it.todo('날짜 조회가 3주기 연속 실패하면 error 로그로 승격한다');
    it.todo('회차 조회 실패는 다음 순번에 재시도된다');
  });

  describe('메일 본문', () => {
    it.todo("시작시각 '2500'은 '익일 01:00'으로 표기한다");
    it.todo('상영 포맷이 포함된 expoProdNm을 제목으로 쓴다');
  });

  describe('감시 목록 파싱', () => {
    it.todo("'라벨:영화번호'와 '영화번호' 형태를 모두 받는다");
    it.todo('영화번호가 아닌 항목은 건너뛴다');
  });
});
