import { test, expect } from '../../src/fixtures/test-fixtures';
import { BaseAPI } from '../../src/fixtures/base-api';
import {
  deleteUser,
  generateToken,
  getUserProfile,
  registerUser,
} from '../../src/functions/auth';
import {
  addToCollection,
  listBooks,
  removeFromCollection,
} from '../../src/functions/books';
import { generateUserData } from '../../src/functions/test-data';

test(
  'Books > E2E > Register, add book, verify, remove, verify gone',
  { annotation: { type: 'ID', description: 'E2E-001' } },
  async ({ apiContext, page, cleanupStack }) => {
    // 1. Register via API (UI registration on DemoQA requires a CAPTCHA).
    const user = generateUserData();
    const registered = await registerUser(apiContext, user);

    cleanupStack.push(async () => {
      try {
        const tr = await generateToken(apiContext, user);
        if (tr.token) {
          const cleanupApi = await BaseAPI.create({ token: tr.token });
          try {
            await deleteUser(cleanupApi, tr.token, registered.userID);
          } finally {
            await cleanupApi.dispose();
          }
        }
      } catch {
        // best-effort
      }
    });

    // 2. Real UI login.
    await page.goto('/login');
    await page.getByPlaceholder('UserName').fill(user.userName);
    await page.getByPlaceholder('Password').fill(user.password);
    await page.getByRole('button', { name: /^login$/i }).click();
    await page.waitForURL(/profile/i, { timeout: 15_000 });
    expect(page.url()).toMatch(/profile/i);

    // 3. Acquire a fresh token AFTER UI login (DemoQA may have invalidated the
    //    pre-login token) and use it for all API operations in this test.
    const tokenRes = await generateToken(apiContext, user);
    expect(tokenRes.token).toBeTruthy();
    const authedApi = await BaseAPI.create({ token: tokenRes.token! });

    try {
      // 4. Add a book via API.
      const list = await listBooks(authedApi);
      const target = list.books[0]!;
      await addToCollection(authedApi, registered.userID, target.isbn);

      let profile = await getUserProfile(authedApi, registered.userID);
      expect(profile.books).toHaveLength(1);
      expect(profile.books[0]!.isbn).toBe(target.isbn);

      // 5. Remove.
      await removeFromCollection(authedApi, registered.userID, target.isbn);
      profile = await getUserProfile(authedApi, registered.userID);
      expect(profile.books).toHaveLength(0);

      // 6. UI reflects empty state — refresh the profile page.
      await page.reload();
      await expect(page.getByText(target.title, { exact: false })).toHaveCount(0);
    } finally {
      await authedApi.dispose();
    }
  },
);
