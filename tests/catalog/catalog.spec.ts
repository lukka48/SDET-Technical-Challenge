import { test, expect } from '../../src/fixtures/test-fixtures';
import { getBook, listBooks } from '../../src/functions/books';

test(
  'Books > Catalog > Lists all books',
  { annotation: { type: 'ID', description: 'CAT-001' } },
  async ({ apiContext }) => {
    const result = await listBooks(apiContext);

    expect(result.books.length).toBeGreaterThan(0);

    for (const book of result.books) {
      expect(book.isbn).toBeTruthy();
      expect(book.title).toBeTruthy();
      expect(book.author).toBeTruthy();
    }

    const isbns = result.books.map((b) => b.isbn);
    expect(new Set(isbns).size).toBe(isbns.length);
  },
);

test(
  'Books > Catalog > Returns single book by ISBN',
  { annotation: { type: 'ID', description: 'CAT-002' } },
  async ({ apiContext }) => {
    const list = await listBooks(apiContext);
    expect(list.books.length).toBeGreaterThan(0);
    const target = list.books[0]!;

    const book = await getBook(apiContext, target.isbn);

    expect(book.isbn).toBe(target.isbn);
    expect(book.title).toBeTruthy();
    expect(book.author).toBeTruthy();
  },
);

test(
  'Books > Catalog > UI shows catalog rows for API books',
  { annotation: { type: 'ID', description: 'CAT-003' } },
  async ({ customPage: page, apiContext }) => {
    const apiResult = await listBooks(apiContext);
    expect(apiResult.books.length).toBeGreaterThan(0);
    const firstBook = apiResult.books[0]!;

    // BASE_URL points at /books; navigate explicitly to land on the catalog page.
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
