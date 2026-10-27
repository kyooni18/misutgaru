# Experimental Mün frontend

This is a separate, early visitor metadata slice, not a replacement for the Vue
frontend. It fetches the existing `/api/meta` endpoint, renders a server name
and plain-text description, supports retry, and navigates between `/` and
`/about` using ordinary browser links. Authentication, most of the Vue visitor dashboard, rich descriptions, and
visual/behavioral parity are not yet implemented. The visitor dashboard now
includes localized, animated users/notes statistics when activities are enabled,
and classic/simple entrance background decoration and responsive placement. A native follow component and injectable service adapter are present under `src/components`, but no profile surface uses them yet. A confirmation dialog supports the follow flow’s warning and question variants; it currently renders plain text and does not implement MFM or progressive backdrop blur. Metadata requests use the shared native API transport in
`src/services/misskey-api.mjs`; at startup the shell reads the same cached account as Vue and supplies its token when present. It refreshes that account through `/api/i` without delaying the initial render. Failed refreshes retain the cached account; invalid-account dialogs, sign-out, and account switching are not yet implemented. No backend files or API contracts are changed.

The statistics use the reusable `AnimatedNumber` component, which follows Vue's
500 ms transition and formatting behavior when its input changes.

The follow flow also has a read-only local preference adapter for confirmation,
reply inclusion, animation, and haptics. It applies Vue's scope selection and defaults;
it reads matching cloud-synchronized values and responds to preference updates
from other tabs, but does not persist fetched cloud values.
The session follow adapter connects these preferences to the native confirmation,
API transport, shared stream, haptics and achievement service. The profile host must
still supply login and user-store updates. Achievement claims use the
same immediate deduplication and 500 ms pacing as Vue.

## Local build

The `@mun/*` 0.1.20 packages were not available from the public npm registry
when this was written. Use a built Mün source checkout and its supported local
link command (Node 20.19+ and pnpm required):

```sh
cd /path/to/Mun
pnpm install && pnpm build
node bin/mun.mjs link /path/to/Misutgaru-Mun/mun-frontend --renderer web --local-root "$PWD" --no-install
cd /path/to/Misutgaru-Mun/mun-frontend
pnpm install
pnpm build
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
intercepts metadata requests; it never writes to or needs a backend. It covers
request shape, failure/retry, rendering, navigation and browser history.

For an opt-in integration check against a **running** backend, configure the
proxy as above and run:

```sh
FRONTEND_URL=http://127.0.0.1:5173/ node --test test/live-meta.mjs
```

 This sends only the unauthenticated,
read-only metadata request and checks that the real response is rendered; it
uses no mock. Point it only at an instance you are authorized to query.

## Inspected boundaries

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
