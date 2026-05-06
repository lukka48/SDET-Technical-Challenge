import { test as base } from '@playwright/test';
import { BaseAPI } from './base-api';
import { createBasePage, type BasePage } from './base-page';
import { deleteUser, generateToken, registerUser } from '../functions/auth';
import { generateUserData } from '../functions/test-data';
import type { UserData } from './types';

export interface TestUser {
  user: UserData;
  userId: string;
  token: string;
  api: BaseAPI;
}

export type CleanupStack = Array<() => void | Promise<void>>;

export const test = base.extend<{
  customPage: BasePage;
  apiContext: BaseAPI;
  /**
   * Per-test cleanup stack. Tests using manual user management push deferred
   * cleanups (delete user, dispose API client). The fixture drains in LIFO
   * order during teardown — runs even when the test throws.
   *
   * Per-test instance, so safe under intra-file parallel mode.
   */
  cleanupStack: CleanupStack;
  /** @deprecated removed in Task 8 once all migrations land */
  testUser: TestUser;
}>({
  apiContext: async ({}, use) => {
    const api = await BaseAPI.create({});
    await use(api);
    await api.dispose();
  },

  customPage: async ({ page, apiContext }, use) => {
    const bp = createBasePage(page, apiContext);
    await use(bp);

    // Teardown — runs even when the test throws.
    const cleanup = await bp._dispose();
    if (!cleanup) return;

    // DemoQA invalidates a JWT when the same user logs in via the UI later in
    // the test, so the fixture's original token may be rejected here. Re-acquire
    // a fresh token via apiContext for the delete.
    try {
      const fresh = await generateToken(apiContext, cleanup.data);
      if (fresh.token) {
        const cleanupApi = await BaseAPI.create({ token: fresh.token });
        try {
          await deleteUser(cleanupApi, fresh.token, cleanup.userId);
        } finally {
          await cleanupApi.dispose();
        }
      }
    } catch {
      // Best-effort — user may already be deleted, or DemoQA may be flaky.
    }
  },

  cleanupStack: async ({}, use) => {
    const stack: CleanupStack = [];
    await use(stack);
    for (const fn of [...stack].reverse()) {
      try {
        await fn();
      } catch {
        // best-effort
      }
    }
  },

  testUser: async ({ apiContext }, use) => {
    const user = generateUserData();
    const registered = await registerUser(apiContext, user);
    const tokenRes = await generateToken(apiContext, user);
    if (!tokenRes.token) {
      throw new Error(`testUser fixture: GenerateToken returned no token: ${tokenRes.result}`);
    }
    const authedApi = await BaseAPI.create({ token: tokenRes.token });
    await use({
      user,
      userId: registered.userID,
      token: tokenRes.token,
      api: authedApi,
    });
    try {
      const fresh = await generateToken(apiContext, user);
      if (fresh.token) {
        const cleanupApi = await BaseAPI.create({ token: fresh.token });
        try {
          await deleteUser(cleanupApi, fresh.token, registered.userID);
        } finally {
          await cleanupApi.dispose();
        }
      } else {
        await deleteUser(authedApi, tokenRes.token, registered.userID);
      }
    } catch {
      // best-effort
    }
    await authedApi.dispose();
  },
});

export { expect } from '@playwright/test';
