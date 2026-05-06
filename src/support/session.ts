import type { Page } from '@playwright/test';

export interface SessionData {
  userId: string;
  userName: string;
  token: string;
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Seeds the authenticated session so UI tests can skip the login flow when login
 * is not the test target.
 *
 * DemoQA's React app reads auth state from COOKIES (`token`, `expires`, `userID`,
 * `userName`) — not from localStorage as the original challenge spec suggested.
 * We set both:
 *   - Cookies so the app recognizes the session and renders the profile/collection.
 *   - localStorage.userInfo so BasePage.getAPI() (which reads from localStorage per
 *     the spec contract) continues to work after this helper runs.
 */
export async function injectSession(page: Page, session: SessionData): Promise<void> {
  const expires = new Date(Date.now() + ONE_DAY_MS).toISOString();
  await page.context().addCookies([
    { name: 'token', value: session.token, domain: 'demoqa.com', path: '/' },
    { name: 'expires', value: encodeURIComponent(expires), domain: 'demoqa.com', path: '/' },
    { name: 'userID', value: session.userId, domain: 'demoqa.com', path: '/' },
    { name: 'userName', value: session.userName, domain: 'demoqa.com', path: '/' },
  ]);

  // Navigate to the origin so localStorage writes land on the correct origin.
  await page.goto('/');
  await page.evaluate(
    (s) => {
      localStorage.setItem(
        'userInfo',
        JSON.stringify({
          userId: s.userId,
          userName: s.userName,
          token: s.token,
          expires: s.expires,
        }),
      );
    },
    { ...session, expires },
  );
}
