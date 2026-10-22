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
