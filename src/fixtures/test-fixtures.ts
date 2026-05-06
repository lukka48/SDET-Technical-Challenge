import { test as base } from '@playwright/test';
import { BaseAPI } from './base-api';
import { createBasePage, type BasePage } from './base-page';
import { deleteUser, generateToken } from '../functions/auth';

export type CleanupStack = Array<() => void | Promise<void>>;

export const test = base.extend<{
  customPage: BasePage;
  apiContext: BaseAPI;
  cleanupStack: CleanupStack;
}>({
  apiContext: async ({}, use) => {
    const api = await BaseAPI.create({});
    await use(api);
    await api.dispose();
  },

  customPage: async ({ page, apiContext }, use) => {
    const bp = createBasePage(page, apiContext);
    await use(bp);

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
      // best-effort
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
});

export { expect } from '@playwright/test';
