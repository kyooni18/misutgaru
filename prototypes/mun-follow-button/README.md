# Native Mün follow-button prototype

This isolated prototype follows `packages/frontend/src/components/MkFollowButton.vue` without changing the Vue application or backend. It requires the Mün web renderer and an adapter providing the services used by `FollowButton.mun`. The fixture supplies deterministic mock services; it is not a production API adapter. A future application should map the adapter to its login, localization, confirmation, authenticated API, stream, haptic and achievement services, and provide Tabler icons and Misskey theme variables.

To run the interaction checks, install or link a built Mün checkout with `@mun/core`, `@mun/web`, `@mun/vite`, Vite and Playwright available under this directory's `node_modules`, then run `node test.mjs`. If the Mün checkout is outside the repository, set `MUN_ROOT` to its path. For manual inspection run `node_modules/.bin/vite --config vite.config.mjs` and open `/fixture.html`.

The fixture checks requests and state transitions, but it is not a visual comparison with Vue or a production integration. The `@State` initializers cannot currently reference component inputs in this compiler; the component synchronizes its state on appearance, so server-rendered markup and the initial pre-appearance frame do not reflect an initially following or pending user. Verify and resolve that gap before integration.
