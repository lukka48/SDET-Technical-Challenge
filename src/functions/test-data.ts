import { faker } from '@faker-js/faker';
import { randomUUID } from 'node:crypto';
import type { AddBookPayload, UserData } from '../fixtures/types';

const SPECIAL_CHARS = '!@#$%^&*';

/**
 * Returns a username that is parallel-safe across many concurrent test runs.
 * Combines Faker's userName with a UUID-derived suffix; effective collision rate ~10^-9.
 * Alphanumeric only — no underscores or punctuation, since some DemoQA endpoints
 * have historically rejected non-alphanumeric usernames.
 */
export function uniqueUsername(): string {
  const fakerName = faker.internet.username().replace(/[^a-zA-Z0-9]/g, '');
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  return `qa${fakerName}${suffix}`;
}

/**
 * Returns a password meeting DemoQA's rules: length 10, ≥1 uppercase, ≥1 lowercase,
 * ≥1 digit, ≥1 special character. Faker's password() does not guarantee this rule
 * set, so we compose it deterministically.
 */
export function uniquePassword(): string {
  const upper = faker.string.alpha({ casing: 'upper', length: 2 });
  const lower = faker.string.alpha({ casing: 'lower', length: 4 });
  const digit = faker.string.numeric({ length: 2 });
  const special = SPECIAL_CHARS[Math.floor(Math.random() * SPECIAL_CHARS.length)] ?? '!';
  const special2 = SPECIAL_CHARS[Math.floor(Math.random() * SPECIAL_CHARS.length)] ?? '@';
  return `${upper}${lower}${digit}${special}${special2}`;
}

export function generateUserData(): UserData {
  return { userName: uniqueUsername(), password: uniquePassword() };
}

/**
 * Builds the nested payload shape DemoQA expects for POST /BookStore/v1/Books.
 * Non-obvious because the API takes an array even when adding a single book.
 */
export function buildAddBookPayload(userId: string, isbn: string): AddBookPayload {
  return { userId, collectionOfIsbns: [{ isbn }] };
}
