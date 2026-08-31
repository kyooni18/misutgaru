# Misutgaru

Misutgaru is a Misskey fork focused on a gradual Vue-to-Vune UI migration, a shared motion/material layer, and lower-overhead backend runtime behavior while preserving the Misskey federation and data-model foundation.

The source is currently an active migration checkpoint rather than a drop-in vanilla tree. New contributors should start with:

- [Current project state](docs/CURRENT_STATE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Delta from vanilla Misskey](docs/VANILLA_DELTA.md)
- [Source map](docs/SOURCE_MAP.md)
- [Vune migration](docs/VUNE.md)

Git checkouts should initialize submodules recursively because Vune is tracked under `packages/modules`. Its animation runtime is included inside that checkout as `@vune-ui/animation`. The 2026-08-28 handoff archive includes the framework sources directly so it remains inspectable without a second download. See the current-state and verification documents before treating a build as release-validated.

Misutgaru remains licensed under the repository licenses and retains upstream Misskey attribution. General upstream contribution rules still apply unless this fork documents a stricter local rule.

## Thanks

<a href="https://sentry.io/"><img src="https://github.com/misskey-dev/misskey/assets/4439005/98576556-222f-467a-94be-e98dbda1d852" height="30" alt="Sentry" /></a>

Thanks to [Sentry](https://sentry.io/) for providing the error tracking platform that helps us catch unexpected errors.

<a href="https://www.chromatic.com/"><img src="https://user-images.githubusercontent.com/321738/84662277-e3db4f80-af1b-11ea-88f5-91d67a5e59f6.png" height="30" alt="Chromatic" /></a>

Thanks to [Chromatic](https://www.chromatic.com/) for providing the visual testing platform that helps us review UI changes and catch visual regressions.

<a href="https://about.codecov.io/for/open-source/"><img src="https://about.codecov.io/wp-content/themes/codecov/assets/brand/sentry-cobranding/logos/codecov-by-sentry-logo.svg" height="30" alt="Codecov" /></a>

Thanks to [Codecov](https://about.codecov.io/for/open-source/) for providing the code coverage platform that helps us improve our test coverage.

<a href="https://crowdin.com/"><img src="https://user-images.githubusercontent.com/20679825/230709597-1299a011-171a-4294-a91e-355a9b37c672.svg" height="30" alt="Crowdin" /></a>

Thanks to [Crowdin](https://crowdin.com/) for providing the localization platform that helps us translate Misskey into many languages.

<a href="https://hub.docker.com/"><img src="https://user-images.githubusercontent.com/20679825/230148221-f8e73a32-a49b-47c3-9029-9a15c3824f92.png" height="30" alt="Docker" /></a>

Thanks to [Docker](https://hub.docker.com/) for providing the container platform that helps us run Misskey in production.

---

<div align="center">
	
Support us with a ⭐ !

[![Star History Chart](https://api.star-history.com/svg?repos=misskey-dev/misskey&type=Date)](https://star-history.com/#misskey-dev/misskey&Date)

</div>
