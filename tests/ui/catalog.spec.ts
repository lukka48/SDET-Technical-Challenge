import { test, expect } from '../../src/fixtures/test-fixtures';
import { listBooks } from '../../src/functions/books';

// Use the shared read-only user's storageState — opt-in per spec, not project-wide.
test.use({ storageState: '.auth/shared-user.json' });

test(
  'Books > Catalog > UI shows catalog rows for API books',
  { annotation: { type: 'ID', description: 'CAT-003' } },
  async ({ customPage: page, apiContext }) => {
    const apiResult = await listBooks(apiContext);
    expect(apiResult.books.length).toBeGreaterThan(0);
    const firstBook = apiResult.books[0]!;

    // BASE_URL points at /books; using `/` against that baseURL resolves to demoqa.com root.
    // Navigate explicitly to BASE_URL so we land on the catalog page.
    await page.goto(process.env.BASE_URL!);

    // (a) at least one row visible (DemoQA renders the catalog as a real <table>)
    const rows = page.getByRole('row');
    await expect(rows.first()).toBeVisible();

    // (b) the first API book's title is rendered somewhere on the page
    await expect(page.getByText(firstBook.title, { exact: false }).first()).toBeVisible();

    // (c) the search input (#searchBox) is visible and empty
    const search = page.locator('#searchBox');
    await expect(search).toBeVisible();
    await expect(search).toHaveValue('');
  },
);
