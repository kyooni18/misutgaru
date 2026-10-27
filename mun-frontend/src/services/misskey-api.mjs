/*
 * SPDX-FileCopyrightText: syuilo and misskey-project
 * SPDX-License-Identifier: AGPL-3.0-only
 */

// Standalone transport corresponding to the Vue frontend's misskey-api.ts.
// The session getter is evaluated per request so account changes take effect.
export function createMisskeyApi({ apiUrl, getAccount, fetch: fetchImpl = (...args) => globalThis.fetch(...args) }) {
  let pending = 0;

  function track(promise) {
    promise.then(() => { pending--; }, () => { pending--; });
    return promise;
  }

  function receive(response) {
    return (response.status === 204 ? Promise.resolve(null) : response.json()).then(body => {
      if (response.status === 200) return body;
      if (response.status === 204) return undefined;
      return Promise.reject(body.error);
    });
  }

  function post(endpoint, data = {}, token, signal) {
    if (endpoint.includes('://')) throw new Error('invalid endpoint');
    pending++;
    return track(new Promise((resolve, reject) => {
      const account = getAccount();
      if (account) data.i = account.token;
      if (token !== undefined) data.i = token;
      fetchImpl(`${apiUrl}/${endpoint}`, {
        method: 'POST',
        body: JSON.stringify(data),
        credentials: 'omit',
        cache: 'no-cache',
        headers: { 'Content-Type': 'application/json' },
        signal,
      }).then(receive).then(resolve, reject);
    }));
  }

  function get(endpoint, data = {}) {
    pending++;
    return track(new Promise((resolve, reject) => {
      const query = new URLSearchParams(data);
      fetchImpl(`${apiUrl}/${endpoint}?${query}`, {
        method: 'GET', credentials: 'omit', cache: 'default',
      }).then(receive).then(resolve, reject);
    }));
  }

  return { post, get, get pendingRequests() { return pending; } };
}
