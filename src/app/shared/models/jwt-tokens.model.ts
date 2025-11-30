export interface IJwtTokens {
  token: string;
  refresh_token: string;
}

export class JwtTokens implements IJwtTokens {
  token: string;
  refresh_token: string;

  constructor() {
    this.token = null;
    this.refresh_token = null;
  }
}
