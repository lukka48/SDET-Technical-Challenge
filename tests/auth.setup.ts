import { test as setup } from '@playwright/test';
import * as fs from 'node:fs/promises';
import { BaseAPI } from '../src/fixtures/base-api';
import { generateUserData } from '../src/functions/test-data';
import { generateToken, registerUser } from '../src/functions/auth';

const STORAGE_PATH = '.auth/shared-user.json';
const META_PATH = '.auth/shared-user-meta.json';

setup('seed shared read-only user', async ({ browser }) => {
  const baseURL = process.env.BASE_URL;
  if (!baseURL) throw new Error('BASE_URL is not set');

  // 1. Register and authenticate via API
  const api = await BaseAPI.create({});
  const user = generateUserData();
  const registered = await registerUser(api, user);
  const tokenRes = await generateToken(api, user);
  if (!tokenRes.token) {
    throw new Error(`Setup: token generation failed: ${tokenRes.result}`);
  }
  await api.dispose();

  // 2. Open a browser context and seed localStorage so storageState carries the session
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(baseURL); // same-origin as the API; required for localStorage to be readable by tests
  await page.evaluate(
    ({ userID, token, userName }) => {
      localStorage.setItem(
        'userInfo',
        JSON.stringify({ userId: userID, userName, token, expires: '' }),
      );
    },
    { userID: registered.userID, token: tokenRes.token, userName: user.userName },
  );

  // 3. Persist storage state for catalog UI tests
  await fs.mkdir('.auth', { recursive: true });
  await context.storageState({ path: STORAGE_PATH });
  await context.close();

  // 4. Stash IDs for cleanup project to delete the shared user
  await fs.writeFile(
    META_PATH,
    JSON.stringify({ userID: registered.userID, token: tokenRes.token }),
  );
});
