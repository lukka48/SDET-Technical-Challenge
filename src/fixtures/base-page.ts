import type { Page } from '@playwright/test';
import { BaseAPI } from './base-api';
import { generateToken, registerUser } from '../functions/auth';
import { generateUserData } from '../functions/test-data';
import { injectSession } from '../support/session';
import type { UserData } from './types';

interface CachedUser {
  data: UserData;
  userId: string;
  token: string;
  authedApi: BaseAPI;
}

export class BasePageImpl {
  private cached: CachedUser | null = null;
  // Promise-memoized so concurrent callers share one registration, not race.
  private inFlight: Promise<CachedUser> | null = null;

  constructor(
    public readonly page: Page,
    private readonly apiContext: BaseAPI,
  ) {}

  /**
   * Lazily registers a fresh user, injects the session into cookies + localStorage,
   * and returns an authed BaseAPI. Subsequent calls reuse the cache.
   *
   * Side-effects on first call: page.context() gets DemoQA auth cookies; the page
   * is navigated to BASE_URL so localStorage.userInfo can be written. Tests that
   * need a logged-out starting state (real UI login flows) MUST NOT call this.
   */
  async getAPI(): Promise<BaseAPI> {
    const u = await this._ensureUser();
    return u.authedApi;
  }

  async getUserId(): Promise<string> {
    const u = await this._ensureUser();
    return u.userId;
  }

  async getUserData(): Promise<UserData> {
    const u = await this._ensureUser();
    return u.data;
  }

  /** Internal — used by the customPage fixture teardown. */
  async _dispose(): Promise<{ data: UserData; userId: string } | null> {
    this.inFlight = null;
    if (!this.cached) return null;
    const { data, userId, authedApi } = this.cached;
    await authedApi.dispose();
    this.cached = null;
    return { data, userId };
  }

  private async _ensureUser(): Promise<CachedUser> {
    if (this.cached) return this.cached;
    if (this.inFlight) return this.inFlight;

    this.inFlight = (async (): Promise<CachedUser> => {
      const data = generateUserData();
      const registered = await registerUser(this.apiContext, data);
      const tokenRes = await generateToken(this.apiContext, data);
      if (!tokenRes.token) {
        throw new Error(`BasePage._ensureUser: GenerateToken failed: ${tokenRes.result}`);
      }
      await injectSession(this.page, {
        userId: registered.userID,
        userName: data.userName,
        token: tokenRes.token,
      });
      const authedApi = await BaseAPI.create({ token: tokenRes.token });
      return { data, userId: registered.userID, token: tokenRes.token, authedApi };
    })();

    try {
      this.cached = await this.inFlight;
      return this.cached;
    } finally {
      this.inFlight = null;
    }
  }
}

export type BasePage = BasePageImpl & Page;

export function createBasePage(page: Page, apiContext: BaseAPI): BasePage {
  const impl = new BasePageImpl(page, apiContext);
  return new Proxy(impl, {
    get(target, prop, receiver) {
      if (prop in target) return Reflect.get(target, prop, receiver);
      const value = (page as unknown as Record<PropertyKey, unknown>)[prop];
      return typeof value === 'function'
        ? (value as (...a: unknown[]) => unknown).bind(page)
        : value;
    },
  }) as unknown as BasePage;
}
