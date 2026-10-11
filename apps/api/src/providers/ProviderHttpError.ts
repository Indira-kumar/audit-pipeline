export class ProviderHttpError extends Error {
  readonly permanent: boolean;

  constructor(
    provider: string,
    readonly status: number,
    detail = '',
  ) {
    super(`${provider} request failed (${status}).${detail}`);
    this.name = 'ProviderHttpError';
    this.permanent = status >= 400 && status < 500 && ![408, 425, 429].includes(status);
  }
}
