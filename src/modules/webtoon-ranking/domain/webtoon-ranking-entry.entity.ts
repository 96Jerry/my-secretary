export class WebtoonRankingEntry {
  constructor(
    public readonly titleId: number,
    public readonly titleName: string,
    public readonly favoriteCount: number,
    // 네이버 장르 코드 (THRILL 등). 특정할 수 없으면 ETC
    public readonly genreCode: string,
    public readonly genreName: string,
  ) {}
}
