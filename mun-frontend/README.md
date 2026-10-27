# Experimental Mün frontend

This is a separate, early visitor metadata slice, not a replacement for the Vue
frontend. It fetches the existing `/api/meta` endpoint, renders a server name
and plain-text description, supports retry, and navigates between `/` and
`/about` using ordinary browser links. Authentication, the Vue visitor dashboard,
localization, rich descriptions, and visual/behavioral parity are not yet
implemented. A native follow component and injectable service adapter are present under `src/components`, but no profile surface uses them yet. A confirmation dialog supports the follow flow’s warning and question variants; it currently renders plain text and does not implement MFM or progressive backdrop blur. Metadata requests use the shared native API transport in
`src/services/misskey-api.mjs`; at startup the shell reads the same cached account as Vue and supplies its token when present. It refreshes that account through `/api/i` without delaying the initial render. Failed refreshes retain the cached account; invalid-account dialogs, sign-out, and account switching are not yet implemented. No backend files or API contracts are changed.

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

Build the checked-out `packages/misskey-js` package before installing this app; the native stream service uses its local `file:` dependency. The stream is lazy and opens only when a component requests it.

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
