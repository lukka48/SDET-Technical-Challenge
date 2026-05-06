import { resolveApi, type ApiSource } from '../support/api-client';
import type { BaseAPI } from '../fixtures/base-api';
import type { BasePage } from '../fixtures/base-page';
import type { RegisterResponse, TokenResponse, UserData, UserProfile } from '../fixtures/types';

export function registerUser(api: BasePage, data: UserData): Promise<RegisterResponse>;
export function registerUser(api: BaseAPI, data: UserData): Promise<RegisterResponse>;
export async function registerUser(api: ApiSource, data: UserData): Promise<RegisterResponse> {
  const client = await resolveApi(api);
  return client.post<RegisterResponse>('/Account/v1/User', {
    userName: data.userName,
    password: data.password,
  });
}

export function generateToken(api: BasePage, creds: UserData): Promise<TokenResponse>;
export function generateToken(api: BaseAPI, creds: UserData): Promise<TokenResponse>;
export async function generateToken(api: ApiSource, creds: UserData): Promise<TokenResponse> {
  const client = await resolveApi(api);
  return client.post<TokenResponse>('/Account/v1/GenerateToken', {
    userName: creds.userName,
    password: creds.password,
  });
}

export function getUserProfile(api: BasePage, userId: string): Promise<UserProfile>;
export function getUserProfile(api: BaseAPI, userId: string): Promise<UserProfile>;
export async function getUserProfile(api: ApiSource, userId: string): Promise<UserProfile> {
  const client = await resolveApi(api);
  return client.get<UserProfile>(`/Account/v1/User/${userId}`);
}

/**
 * Deletes the user and cascades — wipes the user record AND their entire collection.
 * This is the cleanup primitive used by the customPage fixture's teardown.
 *
 * The `token` parameter is mandated by the challenge spec signature. When `api`
 * is already authenticated (which it must be — DELETE requires auth), the bearer
 * header on `api` carries the request and the token argument is redundant. It is
 * retained for spec compliance.
 */
export function deleteUser(api: BasePage, token: string, userId: string): Promise<void>;
export function deleteUser(api: BaseAPI, token: string, userId: string): Promise<void>;
export async function deleteUser(api: ApiSource, _token: string, userId: string): Promise<void> {
  const client = await resolveApi(api);
  await client.delete<void>(`/Account/v1/User/${userId}`);
}
