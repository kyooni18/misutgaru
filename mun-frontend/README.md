# Experimental Mün frontend

This is a separate, early visitor metadata slice, not a replacement for the Vue
frontend. It fetches the existing `/api/meta` endpoint, renders a server name
and server-provided HTML description, supports retry, and navigates between `/` and
`/about` using ordinary browser links. Authentication, most of the Vue visitor dashboard, and
visual/behavioral parity are not yet implemented. Like Vue's `v-html`, the description is trusted server-controlled HTML, not sanitized user input. The visitor dashboard now
includes localized, animated users/notes statistics when activities are enabled,
and classic/simple entrance background decoration and responsive placement. A native follow component and injectable service adapter are present under `src/components`, but no profile surface uses them yet. Metadata requests use the shared native API transport in
`src/services/misskey-api.mjs`; at startup the shell reads the same cached account as Vue and supplies its token when present. It refreshes that account through `/api/i` without delaying the initial render. Failed refreshes retain the cached account; invalid-account dialogs, sign-out, and account switching are not yet implemented. No backend files or API contracts are changed.

## Local build

The `@mun/*` 0.1.20 packages were not available from the public npm registry
when this was written. This frontend requires a built Mün source checkout containing
commit `13c8e4c` (trusted HTML support and descendant cleanup) or a compatible successor; the version
number alone does not identify this capability. Use Mün's supported local link
command (Node 20.19+ and pnpm required):

```sh
cd /path/to/Mun
pnpm install && pnpm build
node bin/mun.mjs link /path/to/Misutgaru-Mun/mun-frontend --renderer web --local-root "$PWD" --no-install
cd /path/to/Misutgaru-Mun/mun-frontend
pnpm install --no-frozen-lockfile
pnpm build
pnpm test:unit
MISUTGARU_API_ORIGIN=http://localhost:3000 pnpm dev
```

Build the checked-out `packages/misskey-js` and `packages/icons-subsetter` packages before installing this app; native streaming and icons use their local `file:` dependencies. The stream is lazy and opens only when a component requests it.

`mun link` changes this directory's `package.json` and creates
`pnpm-workspace.yaml` with machine-specific paths: do not commit those local
changes. The Vite development server proxies `/api` and `/assets/locales` to the configured origin
(default `http://localhost:3000`). Production hosts must serve the built files
with an SPA fallback and proxy `/api` and `/assets/locales` to the unchanged backend on the same
origin. The locale service reuses the Vue frontend’s shared translation engine and generated versioned locale assets. The Vue application is unaffected and remains independently buildable.

For the browser smoke test, install Playwright's Chromium (`pnpm exec playwright
install chromium`), run `pnpm dev` in one terminal and run
`FRONTEND_URL=http://127.0.0.1:5173/ pnpm test:browser` in another. The test
intercepts API and locale requests; it never writes to or needs a backend. It covers
request shape, failure/retry, HTML description and locale fallback, rendering,
navigation and browser history.

For an opt-in integration check against a **running** backend, configure the
proxy as above and run:

```sh
FRONTEND_URL=http://127.0.0.1:5173/ node --test test/live-meta.mjs
```

This checks the unauthenticated, read-only metadata request without a mock and
verifies that the real response is rendered. The page may also request read-only
visitor statistics and locale assets, depending on server configuration. Use a
fresh browser profile with no cached account, and point it only at an instance
you are authorized to query.

## Inspected boundaries

`src/components/mfm.mjs` is an experimental native view-graph MFM renderer.
It uses the same `mfm-js` parser as Vue and currently handles basic formatting,
quotes, code, basic links, hashtags and some nonanimated functions; unsupported constructs are retained as literal
MFM source. The standalone native note card uses this subset, but it does not
provide full MFM parity (in particular link previews, mention previews and emoji are unfinished).
`node --test test/mfm-parity.mjs` compares a structural subset with the real
shared Vue renderer in Chromium, including an untrusted-text fixture. The test
requires Vue and Playwright as test-only dependencies.

- Vue's `packages/frontend/src/pages/welcome.vue` calls `fetchInstance(true)`;
  `instance.ts` sends `meta` with `{ detail: true }`, and `misskey-api.ts`
  defines its POST, JSON, omitted credentials, and no-cache wire format.
  The backend's `packages/backend/src/server/api/endpoints/meta.ts` declares
  unauthenticated access and dispatches detailed metadata to `packDetailed()`.
- Mün's `packages/vite/src/index.ts` exports the compiler plugin;
  `packages/compiler/src/index.ts` compiles `.mun` to JavaScript. Compiled
  state uses `State` from `packages/core/src/state.ts`; lifecycle `.task(id:)`
  is defined in `packages/core/src/graph/modifiers.ts` and implemented in
  `packages/core/src/lifecycle.ts`. `packages/web/src/dom.ts` mounts the view
  graph and subscribes to state changes. The `Text`, `Button`, and raw HTML
  `Element` components used here are implemented in `packages/core/src/views.ts`.
  `Element` takes a props argument before children, even when props are empty.

The isolated comparison `node --test test/visitor-stats-parity.mjs` exercises
the real Vue visitor dashboard and MkNumber against the Mün statistics cards
with controlled API and localization fixtures. It checks the request, labels,
counts and card computed styles, not whole-page parity. As with the follow
prototype comparison, this test additionally requires Vue, `@vitejs/plugin-vue`
and Sass available in the test environment; these are not production runtime
dependencies. Set `MUN_ROOT` if the framework checkout is elsewhere.

`node --test test/signin-reference.mjs` records the Vue sign-in coordinator's
CAPTCHA, TOTP, passkey, fallback, and error requests using controlled page
emitters, transition and backend stubs, and compares those paths with the native
sign-in coordinator. Native sign-in pages and account handoff are not yet wired;
this is not a visual or end-to-end authentication test.

The native `SigninPasskey` step uses the same WebAuthn library as Vue. Its
standalone comparison (`node --test test/passkey-parity.mjs`) checks appearance,
prompt state, retry and TOTP fallback against Vue with controlled prompts; it
does not require a real authenticator or sign-in account.

`SigninTotp` implements six-digit and backup-code input. The standalone
`node --test test/totp-parity.mjs` comparison exercises Vue's input and button
components alongside the native step, including validation and focus.

`node --test test/entrance-parity.mjs` uses the same Vue-only test dependencies
and compares background, logo, shapes, and content geometry at mobile and
desktop widths; it does not compare the unfinished dashboard or timeline.

`TestCaptcha` implements the standalone test CAPTCHA provider; `node --test test/test-captcha-parity.mjs` compares failure, success, reset and unmount against Vue with controlled boundaries. The standalone `SigninPassword` uses it and submits the coordinator’s password/CAPTCHA payload; the forgot-password action is supplied by its host. `node --test test/password-parity.mjs` compares the supported test CAPTCHA path with Vue. hCaptcha, reCAPTCHA, and Turnstile use explicit provider widgets; `node --test test/captcha-widget-parity.mjs` compares their lifecycle and callbacks with Vue using controlled APIs, not live provider verification. mCaptcha uses the upstream receiver package and iframe; `node --test test/mcaptcha-parity.mjs` compares Vue with a controlled receiver against native behavior using the actual package and simulated messages. Live mCaptcha verification remains outstanding. The password step is not yet mounted in a login dialog, and account handoff remains unfinished.
