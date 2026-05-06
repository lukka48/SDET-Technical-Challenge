import { test, expect } from '../../src/fixtures/test-fixtures';
import { BaseAPI } from '../../src/fixtures/base-api';
import {
  deleteUser,
  generateToken,
  getUserProfile,
  registerUser,
} from '../../src/functions/auth';
import { generateUserData } from '../../src/functions/test-data';

test(
  'Auth > Registration > Creates user with valid credentials',
  { annotation: { type: 'ID', description: 'AUTH-001' } },
  async ({ apiContext, cleanupStack }) => {
    const user = generateUserData();

    const result = await registerUser(apiContext, user);

    const tokenRes = await generateToken(apiContext, user);
    expect(tokenRes.token).toBeTruthy();
    const token = tokenRes.token!;
    const authedApi = await BaseAPI.create({ token });
    cleanupStack.push(async () => {
      await deleteUser(authedApi, token, result.userID);
      await authedApi.dispose();
    });

    expect(result.userID).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    );

    const profile = await getUserProfile(authedApi, result.userID);
    expect(profile.username).toBe(user.userName);
    expect(profile.userId).toBe(result.userID);
  },
);

test(
  'Auth > Login > Returns JWT for valid credentials',
  { annotation: { type: 'ID', description: 'AUTH-002' } },
  async ({ apiContext, cleanupStack }) => {
    const user = generateUserData();
    const registered = await registerUser(apiContext, user);
    cleanupStack.push(async () => {
      const tr = await generateToken(apiContext, user);
      if (tr.token) {
        const a = await BaseAPI.create({ token: tr.token });
        await deleteUser(a, tr.token, registered.userID);
        await a.dispose();
      }
    });

    const tokenRes = await generateToken(apiContext, user);

    expect(tokenRes.status).toBe('Success');
    expect(tokenRes.token).toBeTruthy();
    expect(tokenRes.token!.split('.')).toHaveLength(3); 
    expect(tokenRes.expires).toBeTruthy();
    expect(new Date(tokenRes.expires!).getTime()).toBeGreaterThan(Date.now());
  },
);

test(
  'Auth > Login > Rejects invalid credentials',
  { annotation: { type: 'ID', description: 'AUTH-003' } },
  async ({ apiContext }) => {
    // No user is created; no cleanup needed.
    // DemoQA returns HTTP 200 with `{ status: 'Failed', token: null, result: 'User authorization failed.' }`
    const fakeCreds = {
      userName: 'definitelyNotARealUserXyz123',
      password: 'WrongPass!2',
    };

    const res = await apiContext.raw('POST', '/Account/v1/GenerateToken', fakeCreds);
    const body = (await res.json().catch(() => ({}))) as {
      status?: string;
      token?: string | null;
      result?: string;
    };

    expect(body.status).toBe('Failed');
    expect(body.token ?? null).toBeNull();
    expect(String(body.result ?? '')).toMatch(/authoriz/i);
  },
);
