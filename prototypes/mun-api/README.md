# Native Misskey API transport prototype

`misskey-api.mjs` implements the existing Vue frontend's POST/GET transport contract without Vue, including per-request account tokens, explicit token overrides, fetch options, response errors, and the pending-request count. It takes an API URL and a live account getter from the application; it does not own authentication or session storage.

Run `node test.mjs` after linking a built Mün checkout's `node_modules` at `../mun-follow-button/node_modules`. The test loads the checked-out Vue `misskey-api.ts` using Vite with stubbed account and configuration modules, executes both transports against mocked fetches, and compares the resulting requests and responses. No backend data is touched. The native app must supply its real API URL and account state before this prototype can be integrated.
