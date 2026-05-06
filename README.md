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
npx playwright test tests/ui/collection.spec.ts

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
  auth.setup.ts                       Setup project: shared read-only user
  global-teardown-as-project.ts       Teardown project: deletes shared user after the run
  api/auth.spec.ts                    AUTH-001..003
  api/books-catalog.spec.ts           CAT-001, CAT-002
  ui/catalog.spec.ts                  CAT-003
  ui/collection.spec.ts               COLL-001..004
  ui/profile.spec.ts                  PROF-001
  ui/e2e.spec.ts                      E2E-001
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
  const api = await page.getAPI(); // lazily registers a fresh user on first call
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
  const api = await page.getAPI(); // first call: registers a user, injects session, returns authed BaseAPI
  const userId = await page.getUserId();
  await page.goto('/profile'); // navigate AFTER getAPI() — see note below
  // No cleanup code in the test body — fixture teardown handles it.
});
```

The `customPage` fixture is lazy: it does nothing on setup. The first call to `page.getAPI()` (or `getUserId()` / `getUserData()`) registers a fresh user, generates a token, injects the session into cookies + localStorage, and caches an authed `BaseAPI`. Subsequent calls reuse the cache. Tests that need a logged-out starting state simply never call those methods and pay no setup cost.

**Important:** the lazy session injection performs its own `page.goto('/')` so the localStorage write lands on the same-origin page. Always call `page.getAPI()` (or its siblings) BEFORE the test's own `page.goto(...)`, otherwise the fixture's navigation will override yours.

Teardown runs unconditionally — even when the test throws, because Playwright executes fixture teardown after every test. If a user was created, teardown re-acquires a fresh token (DemoQA can invalidate prior JWTs after UI login) and calls `deleteUser`, which cascades to remove the user's entire collection in one call.

### Setup project — shared read-only user

`tests/auth.setup.ts` creates a single shared user before any test runs and persists their session as `.auth/shared-user.json`. The catalog UI test (`CAT-003`) opts in via `test.use({ storageState: '.auth/shared-user.json' })` to skip user creation.

> **Invariant:** only read-only tests use the shared user. No test mutates the shared user's collection — this keeps the suite parallel-safe under `fullyParallel: true`.

A teardown project (`global-teardown-as-project.ts`) runs after all dependents finish and deletes the shared user.

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
- `package-lock.json` is committed — required by `npm ci` and CI's `cache: npm`

## CI/CD

`.github/workflows/test.yml` runs on push and PR to `main`:

1. Install deps (`npm ci`) with caching keyed on `package-lock.json`
2. Cache Playwright browsers across runs
3. Lint → typecheck → test (each gates the next; a stray `test.only` fails fast on lint, before burning ~1 minute on the suite)
4. Upload HTML report on every run; traces and videos only on failure
5. PR annotations via Playwright's GitHub reporter; JUnit XML for downstream tooling

`forbidOnly` and `retries: 1` activate when `CI=true`, blocking committed `test.only` from landing.

## Troubleshooting

- **DemoQA returns 5xx.** The public demo app is occasionally slow. CI retries once; locally, re-run.
- **`npm ci` complains about lockfile.** `package-lock.json` is committed — `git pull` if it's missing.
- **A UI test can't find a control.** DemoQA may have changed strings. Open `--ui` mode (`npx playwright test --ui`) and update the locator from the live DOM.
- **Browser install hangs.** `npx playwright install chromium` downloads ~250MB the first time.
- **`getAPI()` throws "userInfo not in localStorage."** This usually means the test logged in via the real UI (which stores auth in cookies, not localStorage) and then called `getAPI()` afterward. The fixture's lazy registration writes `userInfo` itself, but a real UI login does not. Run `injectSession` after the UI login if you need `getAPI()` to work, or build a `BaseAPI` directly with `BaseAPI.create({ token })`.
