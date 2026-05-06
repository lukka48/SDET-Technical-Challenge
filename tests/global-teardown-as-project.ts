import { test as teardown } from '@playwright/test';
import * as fs from 'node:fs/promises';
import { BaseAPI } from '../src/fixtures/base-api';
import { deleteUser } from '../src/functions/auth';

teardown('delete shared read-only user', async () => {
  try {
    const meta = JSON.parse(await fs.readFile('.auth/shared-user-meta.json', 'utf8')) as {
      userID: string;
      token: string;
    };
    const api = await BaseAPI.create({ token: meta.token });
    await deleteUser(api, meta.token, meta.userID);
    await api.dispose();
  } catch {
    // Best-effort — meta file missing or user already gone is OK.
  }
});
