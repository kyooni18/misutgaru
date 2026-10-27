# Native Mün follow-button prototype

This isolated prototype follows `packages/frontend/src/components/MkFollowButton.vue` without changing the Vue application or backend. It requires the Mün web renderer and an adapter providing the services used by `FollowButton.mun`. The fixture supplies deterministic mock services; it is not a production API adapter. A future application should map the adapter to its login, localization, confirmation, authenticated API, stream, haptic and achievement services, and provide Tabler icons and Misskey theme variables.

To run the interaction checks, install or link a built Mün checkout with `@mun/core`, `@mun/web`, `@mun/vite`, Vite and Playwright available under this directory's `node_modules`, then run `node test.mjs`. If the Mün checkout is outside the repository, set `MUN_ROOT` to its path. For manual inspection run `node_modules/.bin/vite --config vite.config.mjs` and open `/fixture.html`.

The fixture checks requests, state transitions, and an initially-following server render. It is not a visual comparison with Vue or a production integration. Since the compiler currently rejects `@State` initializers that reference view inputs, the view reads the input values until it initializes its state on appearance.
