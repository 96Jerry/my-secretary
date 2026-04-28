export class User {
  constructor(
    public readonly id: string,
    public readonly email: string | null,
    public readonly name: string | null,
    public readonly guildId: string | null = null,
  ) {}
}
