export class WebtoonRankingEntry {
  constructor(
    public readonly titleId: number,
    public readonly titleName: string,
    public readonly favoriteCount: number,
    // 네이버 장르 코드 (THRILL 등). 특정할 수 없으면 ETC
    public readonly genreCode: string,
    public readonly genreName: string,
    // 아래 값들은 컬럼 추가 이후 수집분부터 저장한다. 그 전 스냅샷은 null
    public readonly author: string | null,
    public readonly thumbnailUrl: string | null,
    public readonly starScore: number | null,
    public readonly isRest: boolean | null,
    public readonly isNew: boolean | null,
  ) {}
}
