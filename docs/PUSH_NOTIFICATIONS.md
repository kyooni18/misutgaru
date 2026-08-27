# Web Push

Misutgaru keeps the upstream service-worker push foundation but hardens subscription lifecycle behavior.

Fork-specific work includes:

- detecting installed iOS PWA behavior separately from ordinary browser tabs;
- renewing registration when the configured VAPID key changes;
- handling `pushsubscriptionchange` and re-registering local accounts against the new endpoint;
- avoiding accidental destruction of a shared browser subscription when one local account disables notifications;
- repairing stale per-account registration state.

When editing this area, test at least one normal desktop browser, a multi-account browser profile, VAPID rotation, and iOS installed-PWA behavior. Keep service-worker state transitions idempotent because browsers may retry or deliver lifecycle events after state has already changed.