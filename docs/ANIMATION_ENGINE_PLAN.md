# Misutgaru unified animation engine plan

Status: foundation implemented / migration in progress
Date: 2026-09-10

## Goal

Create one Vue-compatible, browser-native motion runtime for Misutgaru that replaces fragmented UI transition logic without reviving Vune or introducing a second renderer.

The engine should make common motion declarative and semantic while still allowing low-level imperative control where interactions need it. It must preserve exact final values, cancellation, retargeting, reduced-motion behavior, and independent ownership of simultaneously animated properties.

## Implementation checkpoint

The first working engine now lives entirely under `packages/frontend/src/motion/` and is loaded by the existing frontend boot path. No motion package, workspace, or separate build lifecycle is required.

Implemented foundation:

- semantic motion presets and CSS variables backed by the same token table;
- one resolved user/OS reduced-motion policy for JavaScript and tokenized CSS motion;
- shared rAF scheduling with frame tasks plus separated layout reads and writes;
- ownership-aware WAAPI element animation with cancellation, exact final values, pause/play/reverse, and continuous retargeting;
- lifecycle scopes for automatic teardown;
- high-frequency `MotionValue` presentation state without Vue rerenders;
- frame-rate-independent analytic springs and exponential inertia with bounded spring handoff;
- pointer drag gestures with capture, velocity, elastic constraints, and inertial release;
- parallel, sequential, staggered, and time-offset animation orchestration;
- FLIP layout projection on independent `translate` and `scale` channels;
- Vue composables, transition hooks, layout directive, and drag adapter;
- shared off-screen/document-visibility activity control for specialized renderers.

First production migrations cover the context-menu/modal imperative path and tab-highlight layout motion. Shared switch/tab CSS also consumes the central motion tokens. The remaining component transition inventory is intentionally still incremental rather than mass-converted.

Verification for this checkpoint: frontend `vue-tsc` passes, targeted motion/frontend lint passes, 34 focused motion tests pass, and the production frontend build succeeds.

## Current baseline

The active frontend is Vue 3. Motion is currently spread across component CSS, Vue `Transition`/`TransitionGroup`, direct `requestAnimationFrame`, and a small amount of Web Animations API code.

A source inventory on 2026-09-10 found:

- 171 CSS `transition:` declarations in the frontend.
- 43 `@keyframes` blocks.
- 64 Vue transition usages.
- 10 Vue transition-group usages.
- 2 direct Web Animations API `.animate()` calls.
- 59 hard-coded `cubic-bezier(...)` occurrences.
- only 6 explicit `prefers-reduced-motion` checks.

Existing pieces worth keeping or absorbing:

- `MkContextMenu.motion.ts` already demonstrates a small WAAPI transition path.
- `use-animation-activity.ts` already pauses expensive decorative/content animation when its owner is off-screen or the document is hidden.
- the retired Vune motion work established two important requirements: automatic layout FLIP and per-property animation ownership.
- the existing `animation` preference and OS `prefers-reduced-motion` signal must be unified rather than checked independently by components.

## Non-goals

The first engine should not replace every frame loop in the application.

The following remain specialized runtimes:

- Matter.js/game physics.
- WebGL/canvas background renderers.
- audio visualizers and media playback clocks.
- MFM-authored animation semantics.
- game-specific replay/tick loops.

Those systems may consume the shared activity and motion-policy APIs so they pause or simplify consistently, but they should not be forced through UI interpolation primitives.

## Source boundary

The animation engine is an internal frontend subsystem, not a separate Misutgaru package or library.

Keep it under `packages/frontend/src/motion/` so it shares the existing frontend build, dependency graph, browser target, aliases, and release lifecycle. The low-level runtime can stay framework-agnostic by convention, but it should not create a second package boundary just to enforce that separation.

Proposed shape:

```text
packages/frontend/src/motion/
  index.ts
  core/
    types.ts
    clock.ts
    scheduler.ts
    motion-value.ts
    easing.ts
    spring.ts
    interpolate.ts
    ownership.ts
    animation.ts
    timeline.ts
    layout.ts
    policy.ts
    activity.ts
    diagnostics.ts
  vue/
    use-motion.ts
    use-motion-scope.ts
    use-layout-motion.ts
    transition-hooks.ts
    directives.ts
    devtools.ts
```

The `core/` directory must not import Vue. Vue-specific lifecycle, composable, directive, and transition integration belongs in `motion/vue/`, while both layers remain ordinary frontend source compiled by the existing Vue/Vite pipeline.

## Core architecture

### 1. One clock and scheduler

All JavaScript-driven animations share a single requestAnimationFrame scheduler.

The scheduler should:

- run at most one rAF callback per frame for engine-owned JS animation work;
- batch reads before writes;
- stop requesting frames when no JS-driven work is active;
- pause or degrade nonessential work while the document is hidden;
- expose a deterministic clock for unit tests;
- collect frame-cost diagnostics in development mode.

WAAPI animations should remain browser-driven and should not be mirrored by JS every frame unless a subscriber explicitly needs progress updates.

### 2. Native-first execution

Choose the cheapest correct driver for each animation:

1. CSS for durable state styling and simple pseudo-state transitions.
2. Web Animations API for ordinary element property/keyframe animations.
3. shared rAF driver for springs, decay/inertia, custom numeric values, gesture-linked values, or animation forms WAAPI cannot express cleanly.
4. View Transitions API only as an optional enhancement for suitable route/theme/shared-element transitions, never as the sole correctness path.

The engine must not require a third-party animation runtime.

### 3. Semantic motion vocabulary

Components should select semantic presets instead of inventing duration/easing pairs.

Initial vocabulary:

- `instant`
- `feedback`
- `control`
- `surfaceEnter`
- `surfaceLeave`
- `drawer`
- `navigation`
- `layout`
- `backdrop`
- `emphasized`

Each semantic preset can resolve to duration/easing or spring parameters according to policy and device capability.

Expose matching CSS custom properties for CSS-owned transitions so CSS and JS use the same source of truth.

Example generated variables:

```css
--MI-motion-duration-instant
--MI-motion-duration-fast
--MI-motion-duration-standard
--MI-motion-duration-slow
--MI-motion-ease-standard
--MI-motion-ease-emphasized
--MI-motion-ease-exit
```

### 4. Property ownership

Maintain a registry per element and logical property channel.

Starting a new animation claims only the properties it changes. Conflicting owners are cancelled or retargeted; unrelated owners keep running.

Prefer independent CSS transform properties where possible:

- `translate`
- `scale`
- `rotate`

This is essential for layout projection: FLIP translation/scale must not destroy a component's own rotation or authored transform.

Where independent properties are insufficient, provide explicit transform channels backed by CSS custom properties rather than allowing multiple systems to overwrite `transform` blindly.

### 5. Cancellation and retargeting

Every animation returns a handle with at least:

- `status`
- `finished`
- `cancel()`
- `finish()`
- `pause()` / `play()` when supported
- `reverse()` when meaningful
- `retarget(...)`

Retargeting must begin from the current visual value, not from the previous nominal endpoint. Rapidly toggled menus, switches, drawers, tabs, and navigation transitions should remain continuous rather than snapping.

Final committed styles must be exact and stable after an animation completes or is replaced.

### 6. Motion values

Provide small observable `MotionValue<T>` primitives for interaction-linked values.

A motion value tracks current value, previous value, timestamp, and numeric velocity where applicable. It can be driven by pointer input, a spring, a timeline, or an ordinary animation.

Do not replace Vue reactivity with motion values. Vue owns application state; motion values own high-frequency presentation state that should not trigger component rerenders every frame.

### 7. Springs and decay

Implement deterministic analytic or fixed-step spring evaluation with explicit parameters and a small preset layer.

Support:

- spring to target;
- initial velocity;
- interruption and retargeting;
- rest thresholds;
- duration estimation for orchestration where needed;
- decay/inertia with bounds and optional bounce/spring handoff.

The physics must be frame-rate independent and testable with a fake clock.

### 8. Timelines and orchestration

Support grouped animation without component-specific timeout choreography:

- parallel groups;
- sequences;
- relative offsets;
- stagger;
- labels;
- nested groups;
- cancellation propagation.

This should be lightweight. It is for UI choreography, not a general audiovisual timeline editor.

### 9. Automatic layout animation

Provide a layout projection layer based on FLIP.

Requirements:

- measure before/after rectangles in batched read phases;
- animate position and size changes using independent translate/scale ownership;
- support list reorder, insertion/removal, tab indicator movement, collapsing sections, and shared-layout identifiers;
- preserve scroll position and avoid forced-layout loops;
- allow nested layout groups;
- handle interruption by measuring the current projected visual state;
- skip or simplify when reduced motion is active.

The Vue adapter should make this opt-in with a composable/directive rather than requiring components to hand-write FLIP code.

### 10. Gesture layer

A small gesture layer should unify pointer-driven UI motion:

- press/tap feedback;
- hover intent where appropriate;
- drag with pointer capture;
- axis locking;
- velocity estimation;
- drag constraints;
- inertial release;
- swipe/dismiss thresholds.

Gesture recognition should remain separate from application actions. It emits values/events and drives presentation state.

### 11. Motion policy and accessibility

Create one resolved motion policy from:

- the Misutgaru `animation` preference;
- `prefers-reduced-motion`;
- document visibility;
- animation category (`essential`, `functional`, `decorative`, `spatial`);
- optionally runtime quality/performance state.

Reduced motion must not simply mean "return early" everywhere. Resolve each animation to an appropriate alternative:

- decorative animation: disable;
- large spatial travel: replace with short fade or near-zero-distance transition;
- functional state feedback: keep a short non-spatial transition;
- essential progress/state indication: keep visible but simplify.

All Vue transition hooks must still call completion callbacks when animation is suppressed.

### 12. Activity and visibility

Absorb the intent of `useAnimationActivity` into a reusable activity service while keeping a Vue convenience wrapper.

The engine should know when an owner scope is:

- mounted;
- visible in the viewport or near it;
- document-visible;
- explicitly suspended.

Long-lived decorative work should stop when inactive. Ordinary one-shot UI transitions should not become dependent on IntersectionObserver.

### 13. Lifecycle scopes

Animations belong to scopes.

A Vue component or logical surface creates a motion scope; unmounting the scope cancels owned work, disconnects observers, and releases ownership records. Nested scopes should allow a modal or route subtree to be cancelled as a unit.

This prevents detached DOM nodes and stale animation promises from surviving component teardown.

### 14. Development diagnostics

Development-only diagnostics should expose:

- active animations by element/scope;
- chosen driver (CSS/WAAPI/JS/View Transition);
- claimed properties;
- duration/preset;
- cancellations and retargets;
- current spring velocity;
- layout read/write counts;
- long animation frames;
- reduced-motion substitutions;
- active JS-driven frame count.

Keep recording effectively zero-cost when diagnostics are disabled.

## Draft core API

The exact names may change during implementation, but the public model should stay compact.

```ts
const handle = motion.animate(element, {
  opacity: [0, 1],
  scale: [0.96, 1],
}, {
  preset: 'surfaceEnter',
  category: 'spatial',
});

const x = motion.value(0);
const drag = motion.gesture.drag(element, {
  x,
  constraints: { min: -240, max: 0 },
  release: { type: 'inertia', bounce: 'control' },
});

motion.spring(x, 0, { preset: 'control' });

await motion.timeline([
  ['backdrop', () => motion.animate(backdrop, { opacity: [0, 1] }, { preset: 'backdrop' })],
  ['panel', () => motion.animate(panel, { translateY: ['16px', '0px'], opacity: [0, 1] }, { preset: 'surfaceEnter' }), '-=80ms'],
]).finished;
```

Vue integration should support direct transition hooks:

```ts
const { enter, leave } = useMotionTransition({
  enter: { preset: 'surfaceEnter', from: { opacity: 0, scale: 0.96 } },
  leave: { preset: 'surfaceLeave', to: { opacity: 0, scale: 0.96 } },
});
```

And layout motion:

```vue
<div v-motion-layout="item.id">...</div>
```

## Migration strategy

Do not mass-convert 171 transitions at once.

### Phase 0 - foundation

- create the internal `packages/frontend/src/motion/` subsystem;
- implement core tokens, resolved policy, clock/scheduler, ownership registry, WAAPI driver, handles, and tests inside the frontend source tree;
- expose CSS motion variables from the same semantic token table;
- create the Vue motion scope/transition adapters in `motion/vue/`;
- keep all existing visual behavior as the compatibility baseline.

### Phase 1 - current imperative motion

Migrate `MkContextMenu.motion.ts` and menu-enabled `MkModal.vue` first.

They already use imperative WAAPI and are the smallest proof that lifecycle completion, cancellation, policy, and property ownership work correctly.

### Phase 2 - shared surfaces

Migrate dialogs, popups, drawers, router/page transitions, notification surfaces, and common backdrops.

This establishes the semantic surface presets and removes repeated hard-coded bezier/duration pairs.

### Phase 3 - controls and indicators

Migrate buttons, switches, radios, tabs/page-header tab indicators, ranges, and small feedback effects.

Keep simple CSS transitions as CSS, but source their tokens from the engine vocabulary.

### Phase 4 - layout projection

Introduce automatic FLIP for:

- tab indicator geometry;
- list reorder/insertion;
- foldable sections;
- selected-item movement;
- suitable timeline/list transitions.

Do not combine layout migration with unrelated component redesign.

### Phase 5 - gestures

Move swipe/dismiss, drawer drag, and other pointer-linked UI to motion values + gesture primitives where they improve behavior.

### Phase 6 - cleanup and enforcement

- add a lint/check script that reports newly introduced raw duration/easing literals in product UI code;
- allow explicit exceptions for authored MFM, games, media visualizers, and unique one-off effects;
- remove compatibility helpers only after their consumers migrate;
- update architecture docs from "component-owned motion" to the shared engine model.

## First migration targets

Recommended order:

1. `MkContextMenu.motion.ts`
2. `MkModal.vue` menu/drawer path
3. common menu/notification surfaces in `ui/_common_/common.vue`
4. `MkButton.vue`
5. `MkSwitch.button.vue`
6. `MkTabs.vue` and `MkPageHeader.tabs.vue`
7. `StackingRouterView.vue`
8. streaming timeline insertion/removal transitions

Delay complex media/lightbox inertia until the foundation has proven cancellation and gesture behavior.

## Verification gates

The foundation is not complete until all of the following are demonstrated:

- deterministic unit tests for clocks, interpolation, springs, cancellation, retargeting, ownership, and timelines;
- browser tests for WAAPI final-value commitment and interruption;
- browser tests showing transform/layout channels do not overwrite each other;
- reduced-motion tests covering user preference and OS preference combinations;
- Vue unmount tests proving no animation survives its owner scope;
- FLIP tests for reorder, resize, interruption, and nested transforms;
- no permanent rAF loop when the engine is idle;
- no new layout-thrashing loop in the performance e2e guard;
- frontend typecheck, unit tests, and production build pass.

## Performance principles

- Prefer compositor-friendly opacity/translate/scale/rotate.
- Never read layout after writes in the same scheduled phase.
- Keep WAAPI animations browser-owned when per-frame JS observation is unnecessary.
- Avoid Vue reactive writes on every animation frame.
- Stop JS frame scheduling when idle.
- Suspend decorative work off-screen/hidden.
- Do not animate large blur/filter/backdrop-filter values indiscriminately on low-power/mobile paths.
- Preserve exact no-animation paths for tests and reduced-motion users.

## Compatibility principles

- Vue remains the renderer and state/lifecycle owner.
- NIRAX remains the router.
- The engine is an internal frontend presentation subsystem, not a framework replacement or separately versioned library.
- Existing component CSS can migrate incrementally.
- Specialized animation systems can consume policy/activity APIs without being rewritten onto the core interpolator.
- Vune packages or host adapters must not be reintroduced.

## Definition of "unified"

The engine is unified when product UI motion shares:

- one semantic token vocabulary;
- one resolved accessibility policy;
- one JS scheduler/clock;
- one property ownership/cancellation model;
- one layout projection implementation;
- one gesture/motion-value model;
- one Vue lifecycle adapter;
- one diagnostics surface.

It does not require every animation in the repository to execute through the same low-level driver.
