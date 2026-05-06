import { test as base } from '@playwright/test';
import { BaseAPI } from './base-api';
import { createBasePage, type BasePage } from './base-page';
import { generateUserData } from '../functions/test-data';
import { deleteUser, generateToken, registerUser } from '../functions/auth';
import type { UserData } from './types';

export interface TestUser {
  user: UserData;
  userId: string;
  token: string;
  api: BaseAPI;
}

export const test = base.extend<{
  customPage: BasePage;
  apiContext: BaseAPI;
  testUser: TestUser;
}>({
  customPage: async ({ page }, use) => {
    const bp = createBasePage(page);
    await use(bp);
    await bp._dispose();
  },

  apiContext: async ({}, use) => {
    const api = await BaseAPI.create({});
    await use(api);
    await api.dispose();
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
    // Teardown — runs even when the test throws.
    // DemoQA invalidates a JWT when the same user logs in via the UI later in
    // the test, so the fixture's original token may be rejected here. Re-acquire
    // a fresh token unauthenticatedly via apiContext and use that for the delete.
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
        // Token re-acquisition failed (e.g. user already deleted by the test) — fall
        // back to the original authedApi as a best-effort attempt.
        await deleteUser(authedApi, tokenRes.token, registered.userID);
      }
    } catch {
      // Best-effort — user may already be deleted, or DemoQA may be flaky.
    }
    await authedApi.dispose();
  },
});

export { expect } from '@playwright/test';
