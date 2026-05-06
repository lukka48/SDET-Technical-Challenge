import { test, expect } from '../../src/fixtures/test-fixtures';
import { BaseAPI } from '../../src/fixtures/base-api';
import { generateToken, getUserProfile } from '../../src/functions/auth';

test(
  'User > Profile > Displays correct user data after UI login',
  { annotation: { type: 'ID', description: 'PROF-001' } },
  async ({ customPage: page, testUser }) => {
    // Real UI login — login flow IS part of this test's value.
    await page.goto('/login');
    await page.getByPlaceholder('UserName').fill(testUser.user.userName);
    await page.getByPlaceholder('Password').fill(testUser.user.password);
    await page.getByRole('button', { name: /^login$/i }).click();

    // After login, profile page should be reachable.
    // Use waitForURL + url() — `expect(page).toHaveURL(...)` does not work through
    // the BasePage Proxy because the matcher does an internal Page-instance check.
    await page.waitForURL(/profile/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/profile/i);
    await expect(page.getByText(testUser.user.userName).first()).toBeVisible();

    // API-side cross-check.
    // DemoQA invalidates the prior JWT when a new login occurs, so testUser.api's
    // original token may no longer be accepted. Regenerate a fresh token, build a
    // new authed client for this assertion, and dispose it when done.
    const freshTokenRes = await generateToken(testUser.api, testUser.user);
    expect(freshTokenRes.token).toBeTruthy();
    const freshApi = await BaseAPI.create({ token: freshTokenRes.token! });
    try {
      const profile = await getUserProfile(freshApi, testUser.userId);
      expect(profile.username).toBe(testUser.user.userName);
      expect(profile.userId).toBe(testUser.userId);
    } finally {
      await freshApi.dispose();
    }

    // Logout control should be visible (DemoQA renders the single word "Logout").
    await expect(page.getByRole('button', { name: /log\s*out/i })).toBeVisible();
  },
);
