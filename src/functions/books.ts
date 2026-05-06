import { resolveApi, type ApiSource } from '../support/api-client';
import type { BaseAPI } from '../fixtures/base-api';
import type { BasePage } from '../fixtures/base-page';
import { buildAddBookPayload } from './test-data';
import type { AddBookResponse, Book, BookListResponse } from '../fixtures/types';

export function listBooks(api: BasePage): Promise<BookListResponse>;
export function listBooks(api: BaseAPI): Promise<BookListResponse>;
export async function listBooks(api: ApiSource): Promise<BookListResponse> {
  const client = await resolveApi(api);
  return client.get<BookListResponse>('/BookStore/v1/Books');
}

export function getBook(api: BasePage, isbn: string): Promise<Book>;
export function getBook(api: BaseAPI, isbn: string): Promise<Book>;
export async function getBook(api: ApiSource, isbn: string): Promise<Book> {
  const client = await resolveApi(api);
  return client.get<Book>(`/BookStore/v1/Book?ISBN=${encodeURIComponent(isbn)}`);
}

export function addToCollection(
  api: BasePage,
  userId: string,
  isbn: string,
): Promise<AddBookResponse>;
export function addToCollection(
  api: BaseAPI,
  userId: string,
  isbn: string,
): Promise<AddBookResponse>;
export async function addToCollection(
  api: ApiSource,
  userId: string,
  isbn: string,
): Promise<AddBookResponse> {
  const client = await resolveApi(api);
  return client.post<AddBookResponse>('/BookStore/v1/Books', buildAddBookPayload(userId, isbn));
}

export function removeFromCollection(api: BasePage, userId: string, isbn: string): Promise<void>;
export function removeFromCollection(api: BaseAPI, userId: string, isbn: string): Promise<void>;
export async function removeFromCollection(
  api: ApiSource,
  userId: string,
  isbn: string,
): Promise<void> {
  const client = await resolveApi(api);
  await client.delete<void>('/BookStore/v1/Book', { isbn, userId });
}

export function clearCollection(api: BasePage, userId: string): Promise<void>;
export function clearCollection(api: BaseAPI, userId: string): Promise<void>;
export async function clearCollection(api: ApiSource, userId: string): Promise<void> {
  const client = await resolveApi(api);
  await client.delete<void>(`/BookStore/v1/Books?UserId=${encodeURIComponent(userId)}`);
}
