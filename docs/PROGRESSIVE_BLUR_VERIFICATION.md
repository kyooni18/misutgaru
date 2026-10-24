# Progressive blur on macOS

Verified on 2026-10-24 against the current working checkout, including its existing Mün user-card integration.

## Confirmed causes and pipeline

`MkUserPopup.vue` passes `showing` and `blurReady` into `MkUserPopupCard.mun`, which calls `ProgressiveBlurElement` with strength 6, spread 28 and radius 12. The package builds overlapping masked sibling bands and changes their `backdrop-filter` from `blur(0px)` to each band's strength. The Mün Vue renderer turns `.animation(Animation.smooth(0.28), value)` into native CSS transitions. Its sampled spring resolves to 415ms in the current Mün version.

The blur itself renders and its filter values interpolate. The popup's ancestor opacity transition was the rendering defect: opacity below 1 creates a backdrop root, so the bands cannot sample the page behind that ancestor. This can hide an otherwise progressing blur and make it appear suddenly when the ancestor reaches opacity 1. See the [Filter Effects backdrop-root definition](https://drafts.csswg.org/filter-effects-2/#BackdropRoot).

A Chromium pixel probe on the real rendered card confirmed this independently of the animation clock: stripe contrast beside the card was approximately 15 with ancestor opacity 1, versus 116 with opacity 0.999. The computed blur remained unchanged.

The popup's `v-if` also detached its child before `showing=false` could drive the outgoing filter values. Reopening a hidden subtree needed a painted zero-blur state before changing the filter again.

The active package does not animate a CSS custom property, use filter keyframes, or run a per-frame JavaScript blur loop. The shared WAAPI driver in `motion/core/animation.ts` is not the owner of this effect. The existing CSS-owned path integrates with `motion/runtime.ts` through `installMotionCssVariables`; no second animation scheduler was introduced. The separate `MkProgressiveBlur.vue` used by menus is a static spatial blur and was not changed in this fix.

## Changes

- `packages/frontend/src/components/MkUserPopup.vue`: fade only `.pbe-content`, a sibling of the blur bands; keep their ancestors opaque. Preserve the existing content fade and transform timings. Keep the child mounted with `v-show`, paint blur zero on enter/reopen with two scheduled frames, and wait for the actual finite CSS transitions before hiding on exit. Cancel pending entry frames on leave/unmount. No idle frame loop or new geometry/layout reads.
- `packages/progressive-blur-element/src/index.ts`: preserve the original layer geometry, masks, intensities and Mün spring curve. Feature-detect the standard backdrop-filter property and otherwise use the prefixed spelling, avoiding two aliased transitions per band in WebKit. Scale the existing duration/delay through the shared motion policy token.
- `packages/frontend/src/motion/core/tokens.ts`: expose the duration scale for custom CSS-owned curves; disabled animation and reduced motion set it to zero. Existing token tests cover this setting.

No blur approximation, global compositing changes, permanent layer promotion or additional dependency was added.

## Browser checks

`node scripts/test-progressive-blur.mjs --browser=all` starts an isolated Vite fixture using the actual popup SFC, user-card view, blur package, Mün Vue renderer and frontend motion runtime. Network/account services and leaf widgets are stubbed; no backend or authenticated account is needed.

Both macOS Playwright Chromium and Playwright WebKit 26.5 passed:

- initial blur zero, multiple real intermediate computed values, exact final blur;
- outgoing interpolation, keeping the node visible until its blur finishes;
- reopening after `display:none`;
- four reversals 35ms apart, continuity at retarget, no stale `closed` event;
- `prefers-reduced-motion` emulation through the real runtime's matchMedia listener;
- animation preference disabled;
- no remaining native animations after settling and no page errors.

The Chromium check also compares screenshot pixels with/without an ancestor backdrop root. WebKit's automated screenshot surface omitted even a plain backdrop-filter control in this environment, so it was used for computed-style/lifecycle checks only.

### Native Safari

Safari WebDriver was unavailable because remote automation was disabled. Instead, opened a local self-check fixture in native Safari through its normal UI and read its on-page computed-style report and screenshot. Browser-reported version: Safari 27.2. The screenshot visibly showed the progressive blur against the stripe background.

Representative values for the outermost rendered band (target 0.62px):

| Path | Measured progression |
| --- | --- |
| Enter | 0ms: 0; 129ms: 0.261; 262ms: 0.580; 395ms: 0.617; 528ms: 0.620 |
| Leave | 0ms: 0.620; 129ms: 0.125; 262ms: 0.011; 397ms: 0.001; 529ms: 0 |
| Reopen | 0ms: 0; 124ms: 0.275; 255ms: 0.581; 389ms: 0.617; 522ms: 0.620 |

All four rapid-reversal changes preserved the current computed value exactly. The page-level reduced-motion CSS policy and animation preference checks passed. Settled animation count was zero. No animation finishing, scrubbing or playback-rate changes were used.

Native Safari's reduced-motion check set the same CSS policy tokens directly; the macOS accessibility preference itself was not changed. OS media-query delivery was exercised through Playwright emulation instead.

## Project checks and boundaries

- `pnpm --filter frontend typecheck`: passed.
- `pnpm --filter frontend build`: passed.
- Frontend unit suite: 38 files, 225 tests passed.
- `pnpm --filter @misutgaru/progressive-blur-element typecheck`: passed.
- Targeted ESLint on changed production files: passed.
- Full frontend ESLint: blocked by five existing `no-restricted-globals` errors in untouched files: `use-scroll-position-keeper.ts:52` and `snowfall-effect.ts:144,156,415,466`.
- SPDX and diff whitespace checks: passed. Source inventory regenerated.
- `pnpm verify:integrity`: passed (6141 text files scanned).
- The legacy `vune:report` command and `scripts/check-vune-native.mjs` mentioned in AGENTS.md are absent from this checkout.

This verifies the actual animation pipeline in an isolated fixture, not the entire authenticated application. Older Safari versions and other operating systems were not directly exercised; the prefixed branch remains selected by CSS feature support rather than user-agent detection. Existing mask/filter fallback behavior and visual geometry are preserved.
