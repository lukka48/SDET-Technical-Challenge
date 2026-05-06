import type { Page } from '@playwright/test';
import { BaseAPI } from './base-api';

interface UserInfoStorage {
  userId: string;
  userName: string;
  token: string;
  expires: string;
}

/**
 * Subset of UserData that is actually recoverable from `localStorage.userInfo`.
 * The password is NOT stored client-side — tests that need it should keep the
 * generated credentials in scope (e.g. via the `testUser` fixture).
 */
export interface UserDataFromStorage {
  userName: string;
}

export class BasePageImpl {
  private cachedApi: BaseAPI | null = null;

  constructor(public readonly page: Page) {}

  /**
   * Returns an authenticated BaseAPI built from the JWT in localStorage.userInfo.token.
   * Memoized — subsequent calls reuse the same APIRequestContext, which the customPage
   * fixture's teardown disposes.
   *
   * Precondition: page must have navigated to a same-origin URL AND the user must
   * be logged in (userInfo present in localStorage).
   */
  async getAPI(): Promise<BaseAPI> {
    if (this.cachedApi) return this.cachedApi;
    const token = await this.readUserInfo<string>('token');
    this.cachedApi = await BaseAPI.create({ token });
    return this.cachedApi;
  }

  async getUserId(): Promise<string> {
    return this.readUserInfo<string>('userId');
  }

  async getUserData(): Promise<UserDataFromStorage> {
    const info = await this.page.evaluate(() => {
      const raw = localStorage.getItem('userInfo');
      if (!raw) return null;
      return JSON.parse(raw) as { userName: string };
    });
    if (!info) {
      throw new Error('getUserData(): userInfo not in localStorage — log in first');
    }
    return { userName: info.userName };
  }

  /** Internal — called by the customPage fixture teardown. */
  async _dispose(): Promise<void> {
    await this.cachedApi?.dispose();
    this.cachedApi = null;
  }

  private async readUserInfo<T>(key: keyof UserInfoStorage): Promise<T> {
    const value = await this.page.evaluate((k) => {
      const raw = localStorage.getItem('userInfo');
      if (!raw) return undefined;
      const parsed = JSON.parse(raw);
      return parsed[k];
    }, key as string);
    if (value === null || value === undefined) {
      throw new Error(
        `BasePage.readUserInfo: '${String(key)}' not found in localStorage.userInfo — log in first`,
      );
    }
    return value as T;
  }
}

export type BasePage = BasePageImpl & Page;

export function createBasePage(page: Page): BasePage {
  const impl = new BasePageImpl(page);
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
