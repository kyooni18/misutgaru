<!--
SPDX-FileCopyrightText: syuilo and misskey-project
SPDX-License-Identifier: AGPL-3.0-only
-->

# UI motion verification

Scope: drawer polish commit `75be73c8b` and prior shell motion `927e6965e`.

## Preparation and checks

- Read `AGENTS.md` first, then `docs/CURRENT_STATE.md`, followed by architecture, source map and motion topic documentation.
- Foundation recall called with exact arguments `{"project":"misutgaru","query":"UI motion layout pass"}`.
- Frontend typecheck and production build passed; SPDX and diff checks passed.
- Verified `75be73c8b` ends with `Co-Authored-By: OpenAI <noreply@openai.com>`.
- Durable implementation and verification findings saved to Foundation project `misutgaru`.

## Advancing-clock browser check

Used standalone Playwright Chromium against the authenticated scratch instance on localhost:3300. Sampled real computed transforms with requestAnimationFrame; did not call animation.finish(), seek animations, or change their playback rates. Clocks advanced at approximately 8ms per frame. Times below include Vue/frame setup overhead. These are measured browser trajectories, not a claim of human device testing.

| Interaction | Observed trajectory |
| --- | --- |
| Mobile menu open (390×844) | Starts at −250px; −127px at 63ms; −47px at 112ms; settles at 0 and transition classes removed by 346ms. |
| Mobile menu close | Accelerates to −242px at 189ms; removed at 197ms. |
| Widget drawer open (390×844) | Starts at −310px; −157px at 64ms; −48px at 123ms; −13px at 181ms; settled by 356ms. Remains opaque. |
| Widget drawer close | −37px at 60ms; −136px at 118ms; −274px at 177ms; removed by 235ms. |
| Widget drawer with reduced motion | Initial Vue enter-from state, then final position by 69ms without interpolated movement. |
| Desktop navbar pill (1100×844), timeline → notifications | Moves from 0 to 50px; reaches 48.19px at 180ms, gently overshoots to 51.50px at 297ms, returns to exactly 50px by 472ms. |
| Page rise on the same route change | Starts 10px down and transparent; 3.67px / opacity .63 at 64ms; .83px / .92 at 122ms; finishes by 297ms. |
| Mobile FAB scroll down | Moves/scales away, reaches translateY(76px), scale(.6), opacity 0 by 236ms. |
| Mobile FAB scroll up | Returns with a small spring overshoot: scale(1.020), translateY(−3.81px) at 236ms; exact resting state by 411ms. |

Spring assessment from the sampled curves: navbar overshoot is approximately 3% of its travel, and FAB return overshoot approximately 4px. Both settle without repeated oscillation or residual displacement. Drawer entry decelerates monotonically; exit is shorter and accelerates offscreen.

The mobile header Widgets action navigates to a page, not this drawer. To verify the actual common widget drawer, the browser probe set the existing universal component's `widgetsShowing` ref through Vue's development instance, then closed it using its real backdrop. No application source was changed for the probe.

Not covered: subjective physical-device feel, FAB initial mount pop-in, query/hash navigation exclusion, and rapid reversal stress testing.

## Navigation clarity follow-up

The next design pass replaces the mobile snap-scrolling timeline picker and shifting icon labels with a stable two-row header: explicit source menu above three persistently labelled section buttons. This intentionally trades 58px of vertical space for discoverability and 44px-or-larger touch targets. Section content now updates directly instead of waiting for a 220ms header-animation timer. The expanded sidebar uses quieter rounded-rectangle selections; the mobile compose button uses a solid theme accent and softer shadow.

Standalone Chromium checks at widths 320, 390, 768 and 1440 found no header horizontal overflow. At 320px all section targets are 44px tall; with a 20px root font they grow to 55px without horizontal overflow. Verified source selection Home → Local → Home, keyboard Enter opening the source menu, all three section buttons, actual widget content, and restoration of the timeline when resizing to desktop. No page errors occurred in the interaction probe. Reduced-motion layout was also exercised. Drawer, navbar, page and FAB trajectory measurements above remain scoped to their earlier commits.

## Motion reassessment after the compact source-strip header

This pass supersedes the earlier spring/page/header recommendations above. The initial source scan found 317 matching lines across frontend Vue, SCSS and TypeScript (`transition:`, `animation:`, `.animate(` and `@keyframes`); this is a search inventory, not a count of independently tested animations.

### Changes and rationale

- Mobile source labels now interpolate their intrinsic width with CSS grid rather than switching `display`. Selection remains immediate; scrolling reveals the active source without moving the feed. Section headings fade without vertical travel.
- Desktop header tabs use the same grid approach. Removed forced width reflows, overlapping Vue label transitions, the 170ms indicator timeout, and premature mousedown selection. The non-anchor fallback observes tab sizes.
- Connected shared UI duration/easing aliases to the existing motion runtime, so affected controls follow the animation preference as well as reduced motion. Feedback is 120ms; controls are 180ms; expanding content uses the existing 240ms layout token.
- Removed whole-route parent animation: it moved the header along with content and could overlap during rapid navigation.
- Sidebar selection no longer overshoots. Compose-button entry no longer rotates or grows from 40%; scroll dismissal uses a small translation rather than a scale-down flight.
- Modal/popup/drawer CSS exits and Vue removal durations are aligned, with shorter exits and immediate reduced-motion cleanup. Dialog scale is restrained; send dismissal travels 12px rather than 300px.
- Tooltips fade instead of zooming from 75%. Toasts travel 8px instead of their full height. Context menus and user previews have restrained entry motion.
- Folder/container expansion uses consistent layout timing instead of 300–500ms defaults. Streaming notifications settle in 240ms instead of 700ms. Note-action presses no longer bounce. Switch/ripple transitions list their owned properties instead of `all`.
- Reduced-motion CSS now clears delays, limits keyframes to one iteration, and disables smooth scrolling; previously infinite animations could repeat at a 0.01ms duration. Announcement feedback respects both motion preferences and cancels its previous animation before replaying.

### Direct browser evidence

Standalone Chromium with real advancing animation clocks; no animation finishing or scrubbing:

- Home → Local: Home width 81.23px at 14ms, 53.02px at 48ms, 44px at 79ms. Local width 44px, 63.52px, 72.70px at the same samples; 77.22px at 179ms, final 77.25px by 212ms. No width overshoot.
- Global → Home → Local → Home, 30ms apart: final selected source is Home after settling, with no browser errors.
- Reduced-motion label computed duration: 0.00001s.
- Header has no horizontal overflow at 320, 390, 480, 768 and 1440px. At 320px with 20px root text, the header grows to 63px without overflow.
- Options popup opens and is removed after Escape; reduced-motion popup is gone within the 60ms observation window.

### Boundary

This is a cross-cutting UI-motion pass, not a claim that every animation in the product was visually tested. Game motion, authored MFM effects, chart/data animations, loading indicators, media gestures and decorative widget timelines were inventoried but not indiscriminately retimed: they have different semantic or functional timing. They receive the shared reduced-motion CSS protection where applicable. JS-driven game/chart/media behavior and subjective physical-device feel still require dedicated evaluation. Earlier drawer/FAB timing measurements do not describe this pass's changed timings.
