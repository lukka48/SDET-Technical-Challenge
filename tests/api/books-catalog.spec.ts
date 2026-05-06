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
