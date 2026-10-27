/*
 * SPDX-FileCopyrightText: Misutgaru contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 */
import { I18n } from '../../../packages/frontend-shared/js/i18n.ts';
import { version as appVersion } from '../../../package.json';

// The backend serves the same merged, versioned locale files used by Vue.
export async function loadI18n({ getStorage = () => globalThis.localStorage, fetch: fetchImpl = (...args) => globalThis.fetch(...args), version = appVersion } = {}) {
  let language = 'en-US';
  try { language = getStorage()?.getItem('lang') ?? language; } catch { /* Keep the Vue default when storage is unavailable. */ }
  const response = await fetchImpl(`/assets/locales/${language}.${version}.json`);
  if (!response.ok) throw new Error(`Failed to load locale: ${response.status}`);
  const locale = await response.json();
  return new I18n(locale);
}
