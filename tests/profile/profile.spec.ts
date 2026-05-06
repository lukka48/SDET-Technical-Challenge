import { test, expect } from '../../src/fixtures/test-fixtures';
import { BaseAPI } from '../../src/fixtures/base-api';
import {
  deleteUser,
  generateToken,
  getUserProfile,
  registerUser,
} from '../../src/functions/auth';
import { generateUserData } from '../../src/functions/test-data';

test(
  'User > Profile > Displays correct user data after UI login',
  { annotation: { type: 'ID', description: 'PROF-001' } },
  async ({ page, apiContext, cleanupStack }) => {
    // Arrange — register via API; UI registration on DemoQA needs a CAPTCHA.
    const user = generateUserData();
    const registered = await registerUser(apiContext, user);
    cleanupStack.push(async () => {
      const tr = await generateToken(apiContext, user);
      if (tr.token) {
        const a = await BaseAPI.create({ token: tr.token });
        try {
          await deleteUser(a, tr.token, registered.userID);
        } finally {
          await a.dispose();
        }
      }
    });

    // Act — real UI login from a logged-out state.
    await page.goto('/login');
    // Guard: if a future change auto-injects a session, DemoQA redirects away
    // from /login — the test would silently bypass the UI flow it's meant to verify.
    expect(page.url()).toMatch(/login/i);
    await page.getByPlaceholder('UserName').fill(user.userName);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: /^login$/i }).click();
    await page.waitForURL(/profile/i, { timeout: 15_000 });

    // Assert — URL, username on page, and an API-side cross-check.
    // expect(page).toHaveURL is intentionally not used here; the BasePage Proxy
    // breaks Playwright's internal Page-instance check. Plain `page.url()`
    // works because `page` is not proxied.
    expect(page.url()).toMatch(/profile/i);
    await expect(page.getByText(user.userName).first()).toBeVisible();

    // DemoQA invalidates the prior JWT after UI login; re-acquire to verify via API.
    const fresh = await generateToken(apiContext, user);
    expect(fresh.token).toBeTruthy();
    const freshApi = await BaseAPI.create({ token: fresh.token! });
    try {
      const profile = await getUserProfile(freshApi, registered.userID);
      expect(profile.username).toBe(user.userName);
      expect(profile.userId).toBe(registered.userID);
    } finally {
      await freshApi.dispose();
    }

    await expect(page.getByRole('button', { name: /log\s*out/i })).toBeVisible();
  },
);
