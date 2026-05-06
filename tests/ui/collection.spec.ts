import { test, expect } from '../../src/fixtures/test-fixtures';
import {
  addToCollection,
  clearCollection,
  listBooks,
  removeFromCollection,
} from '../../src/functions/books';
import { getUserProfile } from '../../src/functions/auth';
import { injectSession } from '../../src/support/session';

test(
  'Books > Collection > Adds book and reflects in profile',
  { annotation: { type: 'ID', description: 'COLL-001' } },
  async ({ customPage: page, testUser }) => {
    const list = await listBooks(testUser.api);
    const target = list.books[0]!;

    await addToCollection(testUser.api, testUser.userId, target.isbn);

    const profile = await getUserProfile(testUser.api, testUser.userId);
    expect(profile.books).toHaveLength(1);
    expect(profile.books[0]!.isbn).toBe(target.isbn);

    await injectSession(page, {
      userId: testUser.userId,
      userName: testUser.user.userName,
      token: testUser.token,
    });
    await page.goto('/profile');
    await expect(page.getByText(target.title, { exact: false }).first()).toBeVisible();
  },
);

test(
  'Books > Collection > Removes single book',
  { annotation: { type: 'ID', description: 'COLL-002' } },
  async ({ customPage: page, testUser }) => {
    const list = await listBooks(testUser.api);
    const target = list.books[0]!;

    await addToCollection(testUser.api, testUser.userId, target.isbn);
    await removeFromCollection(testUser.api, testUser.userId, target.isbn);

    const profile = await getUserProfile(testUser.api, testUser.userId);
    expect(profile.books).toHaveLength(0);

    await injectSession(page, {
      userId: testUser.userId,
      userName: testUser.user.userName,
      token: testUser.token,
    });
    await page.goto('/profile');
    await expect(page.getByText(target.title, { exact: false })).toHaveCount(0);
    await expect(page.getByRole('table')).toBeVisible();
  },
);

test(
  'Books > Collection > Rejects duplicate add',
  { annotation: { type: 'ID', description: 'COLL-003' } },
  async ({ testUser }) => {
    const list = await listBooks(testUser.api);
    const target = list.books[0]!;

    // First add — confirms the user starts with one book.
    await addToCollection(testUser.api, testUser.userId, target.isbn);
    let profile = await getUserProfile(testUser.api, testUser.userId);
    expect(profile.books).toHaveLength(1);

    // Duplicate add — use raw() because addToCollection auto-throws on non-2xx.
    const res = await testUser.api.raw('POST', '/BookStore/v1/Books', {
      userId: testUser.userId,
      collectionOfIsbns: [{ isbn: target.isbn }],
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);

    // The collection must remain unchanged (still exactly one book, the original).
    profile = await getUserProfile(testUser.api, testUser.userId);
    expect(profile.books).toHaveLength(1);
    expect(profile.books[0]!.isbn).toBe(target.isbn);
  },
);

test(
  'Books > Collection > Clears entire collection',
  { annotation: { type: 'ID', description: 'COLL-004' } },
  async ({ testUser }) => {
    const list = await listBooks(testUser.api);
    expect(list.books.length).toBeGreaterThanOrEqual(2);
    const [first, second] = [list.books[0]!, list.books[1]!];

    await addToCollection(testUser.api, testUser.userId, first.isbn);
    await addToCollection(testUser.api, testUser.userId, second.isbn);

    let profile = await getUserProfile(testUser.api, testUser.userId);
    expect(profile.books).toHaveLength(2);

    await clearCollection(testUser.api, testUser.userId);

    profile = await getUserProfile(testUser.api, testUser.userId);
    expect(profile.books).toHaveLength(0);

    // Idempotency: a second clear should not throw.
    await clearCollection(testUser.api, testUser.userId);
  },
);
