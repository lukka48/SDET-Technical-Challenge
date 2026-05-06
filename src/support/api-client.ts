import { BaseAPI } from '../fixtures/base-api';
import type { BasePage } from '../fixtures/base-page';

export type ApiSource = BasePage | BaseAPI;

function isBaseAPI(source: ApiSource): source is BaseAPI {
  return '__brand' in source && (source as BaseAPI).__brand === 'BaseAPI';
}

/**
 * Returns a BaseAPI for either input. For BaseAPI, returns it as-is. For BasePage,
 * builds a fresh authenticated BaseAPI from the page's JWT.
 *
 * Discrimination uses a brand-string check so it works across realms and multiple
 * class copies — `instanceof` would fail in those cases.
 */
export async function resolveApi(source: ApiSource): Promise<BaseAPI> {
  if (isBaseAPI(source)) return source;
  return source.getAPI();
}
