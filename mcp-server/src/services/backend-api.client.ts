import { env } from '../config/env.js';
import { ToolError } from '../errors/app-error.js';

export class BackendApiClient {
  constructor(private readonly getToken: () => string) {}

  async get(path: string): Promise<unknown> {
    let response: Response;
    try {
      response = await fetch(new URL(path, process.env.BACKEND_BASE_URL ?? env.BACKEND_BASE_URL), {
        headers: { Authorization: `Bearer ${this.getToken()}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
    } catch {
      throw new ToolError('Movie booking backend is unavailable');
    }

    const body: unknown = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 401) throw new ToolError('Authentication expired; sign in again');
      if (response.status === 404) throw new ToolError('Requested resource was not found or is not accessible');
      if (response.status === 400) throw new ToolError('The request is invalid');
      throw new ToolError('Movie booking backend could not complete the request');
    }
    return body;
  }
}
