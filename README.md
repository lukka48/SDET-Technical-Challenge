# SDET Technical Challenge — DemoQA Book Store Framework

Production-ready Playwright + TypeScript testing framework targeting the DemoQA Book Store demo app. Architecture-first: a Proxy-based `BasePage`, a typed `BaseAPI` wrapper, three helper modules with overloaded signatures, parallel-safe tests with guaranteed cleanup, and a green-on-clone CI workflow.

## Prerequisites

- **Node.js >= 20 LTS** (verify with `node -v`)
- **npm >= 10** (bundled with Node 20)
- **git**
- **OS:** macOS, Linux, or Windows. Tested on Windows 11 + Ubuntu 22.04 (CI).
- **Bash shell.** All commands assume bash (Git Bash, WSL, macOS Terminal). PowerShell does not support `&&` chaining.

## Quick start/ Installation Steps

```bash
git clone <https://github.com/lukka48/SDET-Technical-Challenge.git>
cd SDET-Technical-Challenge
npm ci                              
npx playwright install chromium      
npx playwright test                
```

## Environment variables

| Variable        | Purpose               | Default in `.env.example`  |
| --------------- | --------------------- | -------------------------- | 
| `BASE_URL`      | UI base URL           | `https://demoqa.com/books` |
| `API_BASE_URL`  | API base URL          | `https://demoqa.com`       |
| `TEST_USERNAME` | Local-dev placeholder | `your_test_user`           |
| `TEST_PASSWORD` | Local-dev placeholder | `your_test_password`       |

## Running tests

```bash
# Run all tests
npx playwright test

# Run a single spec
npx playwright test tests/collection/collection.spec.ts

# Interactive UI mode 
npx playwright test --ui

# View HTML report
npx playwright show-report
```

## Project structure

```
.github/workflows/test.yml   CI workflow (lint → typecheck → tests → artifacts)
src/
  fixtures/
    base-api.ts              BaseAPI wrapper — auto-throws on non-2xx, JSON parse, brand-string discriminator
    base-page.ts             BasePage Proxy — fuses Playwright Page with domain methods
    test-fixtures.ts         customPage, apiContext, cleanupStack
    types.ts                 Shared TypeScript types for DemoQA contracts
  functions/
    auth.ts                  registerUser, generateToken, getUserProfile, deleteUser
    books.ts                 listBooks, getBook, addToCollection, removeFromCollection, clearCollection
    test-data.ts             uniqueUsername, uniquePassword, generateUserData, buildAddBookPayload
  support/
    api-client.ts            resolveApi() — narrows ApiSource to BaseAPI
    session.ts               injectSession() — seeds cookies + localStorage for UI tests
tests/
  auth/auth.spec.ts                   AUTH-001..003
  catalog/catalog.spec.ts             CAT-001, CAT-002, CAT-003
  collection/collection.spec.ts       COLL-001..004
  profile/profile.spec.ts             PROF-001
  e2e/e2e.spec.ts                     E2E-001
playwright.config.ts                  Projects, retries, reporters, env-aware CI behavior
package.json                          All dependencies declared
tsconfig.json                         Strict mode, @/* alias to src/*
eslint.config.mjs                     Playwright recommended rules
.prettierrc.json                      Formatting rules
.gitignore                            Excludes .env, node_modules, artifacts
```

## Architecture

### Custom fixtures

**`BasePage`** is a JavaScript `Proxy` over Playwright's `Page`. Tests get native `Page` methods AND domain helpers (`getAPI`, `getUserId`, `getUserData`) from a single object:

```ts
test('example', async ({ customPage: page }) => {
  const api = await page.getAPI(); 
  await page.goto('/profile'); // native Page method — call AFTER getAPI() so the lazy fixture's session navigation does not clobber it
  await expect(page.getByRole('row')).toBeVisible();
});
```

The Proxy's `get` trap routes domain methods to the impl and forwards everything else to the underlying `Page`, binding `this` correctly. The intersection type `BasePage = BasePageImpl & Page` gives TypeScript visibility into both surfaces.

**`BaseAPI`** is an opinionated wrapper around `APIRequestContext`: auto-throws on non-2xx, parses JSON, prepends `API_BASE_URL`, and adds bearer auth when given a token. A `raw()` escape hatch is provided for negative tests that must inspect 4xx/5xx responses.

```ts
test('api example', async ({ apiContext }) => {
  const user = generateUserData();
  const result = await registerUser(apiContext, user);
  expect(result.userID).toMatch(/^[0-9a-f-]{36}$/);
});
```

### `customPage` — lazy user creation with guaranteed cleanup

```ts
test('uses customPage', async ({ customPage: page }) => {
  const api = await page.getAPI();
  const userId = await page.getUserId();
  await page.goto('/profile'); 
});
```

The `customPage` fixture is lazy: it does nothing on setup. The first call to `page.getAPI()` (or `getUserId()` / `getUserData()`) registers a fresh user, generates a token, injects the session into cookies + localStorage, and caches an authed `BaseAPI`. Subsequent calls reuse the cache. Tests that need a logged-out starting state simply never call those methods and pay no setup cost.

**Important:** the lazy session injection performs its own `page.goto('/')` so the localStorage write lands on the same-origin page. Always call `page.getAPI()` (or its siblings) BEFORE the test's own `page.goto(...)`, otherwise the fixture's navigation will override yours.

Teardown runs unconditionally — even when the test throws, because Playwright executes fixture teardown after every test. If a user was created, teardown re-acquires a fresh token (DemoQA can invalidate prior JWTs after UI login) and calls `deleteUser`, which cascades to remove the user's entire collection in one call.

### Helper functions overview

13 functions across 3 modules. Every helper is overloaded to accept either a `BasePage` (UI tests) or a `BaseAPI` (API tests). 

| Module         | Function                                  | Endpoint                                      |
| -------------- | ----------------------------------------- | --------------------------------------------- |
| `auth.ts`      | `registerUser(api, data)`                 | `POST /Account/v1/User`                       |
| `auth.ts`      | `generateToken(api, creds)`               | `POST /Account/v1/GenerateToken`              |
| `auth.ts`      | `getUserProfile(api, userId)`             | `GET /Account/v1/User/{userId}`               |
| `auth.ts`      | `deleteUser(api, token, userId)`          | `DELETE /Account/v1/User/{userId}` (cascades) |
| `books.ts`     | `listBooks(api)`                          | `GET /BookStore/v1/Books`                     |
| `books.ts`     | `getBook(api, isbn)`                      | `GET /BookStore/v1/Book?ISBN=...`             |
| `books.ts`     | `addToCollection(api, userId, isbn)`      | `POST /BookStore/v1/Books`                    |
| `books.ts`     | `removeFromCollection(api, userId, isbn)` | `DELETE /BookStore/v1/Book`                   |
| `books.ts`     | `clearCollection(api, userId)`            | `DELETE /BookStore/v1/Books?UserId=...`       |
| `test-data.ts` | `uniqueUsername()`                        | Faker + UUID-suffix; parallel-safe            |
| `test-data.ts` | `uniquePassword()`                        | Meets DemoQA's password rules                 |
| `test-data.ts` | `generateUserData()`                      | `{ userName, password }`                      |
| `test-data.ts` | `buildAddBookPayload(userId, isbn)`       | Nested DemoQA shape                           |
                                                                                                   

## Coding standards

- **TypeScript strict mode** + `noUncheckedIndexedAccess` + `noImplicitOverride`
- **ESLint flat config** with `typescript-eslint` and `eslint-plugin-playwright`. `@typescript-eslint/no-explicit-any: error`, `no-console: error`, `playwright/no-skipped-test: error`.
- **Prettier** — single source of formatting truth
- **Test naming convention:** `Domain > Feature > Action`
- **Annotation IDs** on every test: `{ annotation: { type: 'ID', description: '<TAG-NNN>' } }`
- **At least 3 meaningful assertions** per test
