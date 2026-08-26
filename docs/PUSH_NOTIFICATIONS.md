# Push notifications

Misutgaru delivers background notifications through the standard Web Push API
and the `/sw.js` service worker. The same subscription protocol is used by the
installed PWA on mobile and desktop, so the server does not need a separate
provider account for each operating system.

## Platform support

| Platform | Supported experience | Requirement |
| --- | --- | --- |
| iOS / iPadOS | Home Screen web app | iOS/iPadOS 16.4 or later; open the site in Safari, use **Share → Add to Home Screen**, then enable notifications from the installed app |
| Android | Browser or installed PWA | HTTPS and a browser with Service Worker, Push API, and Notifications support |
| macOS | Safari, Chromium, or Firefox | HTTPS; Safari web push requires a supported macOS/Safari release |
| Windows | Chromium or Firefox | HTTPS and an enabled desktop notification provider |
| Linux | Chromium or Firefox | HTTPS and a desktop notification provider (for example, a running desktop portal) |

iOS browsers use the WebKit runtime and therefore follow the Home Screen rule.
The capability check in `packages/frontend/src/utility/push-notifications.ts`
reports this as `ios-install-required` instead of treating the instance as
broken.

## Instance setup

1. Generate one VAPID key pair for the instance, for example with
   `pnpm --filter backend exec web-push generate-vapid-keys`.
2. In the administrator Service Worker settings, enable Service Worker and
   enter the VAPID public and private keys.
3. Serve the instance over HTTPS. `localhost` is allowed for local testing,
   but production push services reject insecure origins.
4. Users enable push notifications from **Settings → Notifications**. The
   permission request is intentionally made from the button click, which is
   required by iOS and by browsers that restrict notification prompts.

The server registers the endpoint and its `auth`/`p256dh` keys in
`sw_subscription`. Delivery uses a 24-hour TTL and removes endpoints that the
push service reports as expired (`404` or `410`); read-all events use a short
60-second TTL. A VAPID key rotation causes
the browser subscription to be replaced before it is registered again.
If the browser rotates a subscription in the background, the Service Worker
re-registers the new endpoint for every local account and preserves each
account on the current instance and preserves each account's read-message
preference.

## Operational notes

- Push payloads are encrypted by `web-push`; the instance never needs an APNs,
  FCM, WNS, or platform-specific application credential for the PWA path.
- iOS may ignore optional notification action buttons, but the notification
  itself and its default click route remain available.
- A browser can revoke or rotate a subscription at any time. Opening the
  notification settings page re-checks the endpoint with `sw/show-registration`
  and exposes the subscribe action again when re-registration is required.
