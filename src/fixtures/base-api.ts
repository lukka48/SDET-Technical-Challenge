import { request, type APIRequestContext, type APIResponse } from '@playwright/test';

export class BaseAPI {
  
  readonly __brand = 'BaseAPI' as const;

  private constructor(private readonly ctx: APIRequestContext) {}

  static async create(opts: { token?: string }): Promise<BaseAPI> {
    const baseURL = process.env.API_BASE_URL;
    if (!baseURL) {
      throw new Error('API_BASE_URL is not set in the environment variables');
    }
    const ctx = await request.newContext({
      baseURL,
      extraHTTPHeaders: opts.token ? { Authorization: `Bearer ${opts.token}` } : {},
    });
    return new BaseAPI(ctx);
  }

  async get<T>(path: string): Promise<T> {
    return this.send<T>('GET', path);
  }

  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.send<T>('POST', path, body);
  }

  async delete<T>(path: string, body?: unknown): Promise<T> {
    return this.send<T>('DELETE', path, body);
  }

  /** Returns the raw response — used for negative tests that must inspect status. */
  async raw(method: 'GET' | 'POST' | 'DELETE', path: string, body?: unknown): Promise<APIResponse> {
    return this.ctx.fetch(path, { method, data: body });
  }

  private async send<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.ctx.fetch(path, { method, data: body });
    if (!res.ok()) {
      const text = await res.text().catch(() => '<no body>');
      throw new Error(`${method} ${path} -> ${res.status()} ${res.statusText()}\n${text}`);
    }
    
    const text = await res.text();
    if (text.length === 0) return undefined as T;
    return JSON.parse(text) as T;
  }

  async dispose(): Promise<void> {
    await this.ctx.dispose();
  }
}
