import { test, expect } from '../../src/fixtures/test-fixtures';
import {
  addToCollection,
  clearCollection,
  listBooks,
  removeFromCollection,
} from '../../src/functions/books';
import { getUserProfile } from '../../src/functions/auth';

test(
  'Books > Collection > Adds book and reflects in profile',
  { annotation: { type: 'ID', description: 'COLL-001' } },
  async ({ customPage: page }) => {
    // Arrange
    const api = await page.getAPI();
    const userId = await page.getUserId();
    const list = await listBooks(api);
    const target = list.books[0]!;

    // Act
    await addToCollection(api, userId, target.isbn);

    // Assert
    const profile = await getUserProfile(api, userId);
    expect(profile.books).toHaveLength(1);
    expect(profile.books[0]!.isbn).toBe(target.isbn);

    await page.goto('/profile');
    await expect(page.getByText(target.title, { exact: false }).first()).toBeVisible();

    // Cleanup is handled by the customPage fixture teardown.
  },
);

test(
  'Books > Collection > Removes single book',
  { annotation: { type: 'ID', description: 'COLL-002' } },
  async ({ customPage: page }) => {
    const api = await page.getAPI();
    const userId = await page.getUserId();
    const list = await listBooks(api);
    const target = list.books[0]!;

    await addToCollection(api, userId, target.isbn);
    await removeFromCollection(api, userId, target.isbn);

    const profile = await getUserProfile(api, userId);
    expect(profile.books).toHaveLength(0);

    await page.goto('/profile');
    await expect(page.getByText(target.title, { exact: false })).toHaveCount(0);
    await expect(page.getByRole('table')).toBeVisible();
  },
);

test(
  'Books > Collection > Rejects duplicate add',
  { annotation: { type: 'ID', description: 'COLL-003' } },
  async ({ customPage: page }) => {
    const api = await page.getAPI();
    const userId = await page.getUserId();
    const list = await listBooks(api);
    const target = list.books[0]!;

    // First add — confirms the user starts with one book.
    await addToCollection(api, userId, target.isbn);
    let profile = await getUserProfile(api, userId);
    expect(profile.books).toHaveLength(1);

    // Duplicate add — use raw() because addToCollection auto-throws on non-2xx.
    const res = await api.raw('POST', '/BookStore/v1/Books', {
      userId,
      collectionOfIsbns: [{ isbn: target.isbn }],
    });
    expect(res.status()).toBeGreaterThanOrEqual(400);

    // The collection must remain unchanged (still exactly one book, the original).
    profile = await getUserProfile(api, userId);
    expect(profile.books).toHaveLength(1);
    expect(profile.books[0]!.isbn).toBe(target.isbn);
  },
);

test(
  'Books > Collection > Clears entire collection',
  { annotation: { type: 'ID', description: 'COLL-004' } },
  async ({ customPage: page }) => {
    const api = await page.getAPI();
    const userId = await page.getUserId();
    const list = await listBooks(api);
    expect(list.books.length).toBeGreaterThanOrEqual(2);
    const [first, second] = [list.books[0]!, list.books[1]!];

    await addToCollection(api, userId, first.isbn);
    await addToCollection(api, userId, second.isbn);

    let profile = await getUserProfile(api, userId);
    expect(profile.books).toHaveLength(2);

    await clearCollection(api, userId);

    profile = await getUserProfile(api, userId);
    expect(profile.books).toHaveLength(0);

    // Idempotency: a second clear should not throw.
    await clearCollection(api, userId);
  },
);
