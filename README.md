# Opaque UI

A working prototype of private contact components for React. The host passes an opaque handle and presentation props. A provider on another origin resolves the handle and renders the personal information inside an iframe.

## Live demo

[Open the GitHub Pages playground](https://pgherveou.github.io/iframe-playground/).

The hosted demo serves the playground and renderer from the same website. It uses `sandbox="allow-scripts"` without `allow-same-origin`, so each active iframe has an opaque origin and the host's DOM-access test still fails with `SecurityError`. Selection, focus, clear, and the message log work across that sandbox.

**The static demo's fictional data is public.** Its renderer bundle and avatars can be fetched by the host or anyone else. The host also controls the sandbox attribute and could remove it and reload the frame. This demonstrates component composition and sandboxed DOM access, not confidentiality against a malicious embedding application. The separate-origin Node provider below remains the default local mode.

To build and check the same-site version locally:

```sh
npm run build:pages
npm run test:pages
npm run preview:pages
```

Open **http://localhost:5185/iframe-playground/**. This version needs only one static web server. The build includes the renderer at `provider/index.html`, a classic bundled script, styles, and avatars; all asset URLs respect the project path.

The [Pages workflow](.github/workflows/pages.yml) builds, checks formatting, runs unit and browser tests, and deploys on pushes to `main`. Repository Settings → Pages uses **GitHub Actions** as the publishing source. To run the same browser checks against the live site:

```sh
PAGES_URL=https://pgherveou.github.io/iframe-playground/ npm run test:pages
```

In sandbox mode, provider messages have origin `"null"` and must also match the exact iframe window, channel, schema, and pending request. Commands to an opaque-origin iframe require `targetOrigin: "*"`; these commands contain only public action metadata. The default separate-origin mode keeps its exact origin checks and target origin.

## Run locally

Requires Node.js 22.12+ and npm. Both servers bind to localhost.

```sh
npm install
npm run dev
```

Open **http://localhost:5183**. The trusted renderer runs at **http://localhost:5184**. Both ports are fixed so an occupied port fails instead of silently changing the security boundary.

Try the Contact, Avatar, and Contact list tabs. Change handles and props, test DOM access, and search or select a contact inside the list. In Contact list, the host receives the selected handle and uses it to display a separate Contact iframe. **Focus search** and **Clear selection** send commands without reloading the list or revealing its search text. The playground's event log shows the actual commands, selection events, and acknowledgments in both directions. The React example and rendered iframe view show what the host actually has.

All contacts are fictional. Fonts and illustrated avatars are served locally; the running demo makes no third-party requests.

## React API

The workspace contains a real, buildable npm package named `@opaque-ui/react`. It has not been published to the registry.

```tsx
import { useRef } from 'react'
import { Avatar, Contact, ContactList, ContactProvider } from '@opaque-ui/react'
import type { ContactListRef } from '@opaque-ui/react'

export function People() {
  const list = useRef<ContactListRef>(null)

  return (
    <ContactProvider origin="http://localhost:5184">
      <Avatar contact_id="ct_7hk2" size="large" />
      <Contact contact_id="ct_7hk2" username avatar />
      <ContactList
        ref={list}
        list_id="ls_4dn9"
        onSelect={(handle) => console.log(handle)}
        onAction={(action) => console.log('Completed:', action)}
        onMessage={(entry) => console.log(entry.direction, entry.message)}
      />
      <button onClick={() => list.current?.focusSearch()}>Focus search</button>
      <button onClick={() => list.current?.clearSelection()}>
        Clear selection
      </button>
    </ContactProvider>
  )
}
```

`username` and `avatar` default to `true`. `username` controls both the display name and username. Components accept `theme="light" | "dark"`; Contact and ContactList also accept `density="comfortable" | "compact"`. Avatar supports `size="small" | "medium" | "large"`.

See [the package README](packages/react/README.md) for dimensions, defaults, and integration details. To create a local installable package:

```sh
npm run build -w @opaque-ui/react
mkdir -p .agent/artifacts
npm pack -w @opaque-ui/react --pack-destination .agent/artifacts
```

The archive contains the compiled wrapper, TypeScript declarations, and documentation. It contains no provider code or contact records. An app using the package must configure a compatible provider that allows its origin.

## What crosses the boundary

```text
Host application (localhost:5183)
  │  handle + component type + presentation props
  │  explicit focus-search / clear-selection commands
  ▼
Provider iframe (localhost:5184)
  │  server resolves handle and renders private HTML
  │  list search stays inside this document
  ▼
Selection event → opaque contact handle only
Action result → request ID + action only
```

- The host bundle imports only the React wrapper package. Contact records stay in the provider's server code.
- `/embed` returns server-rendered HTML. There is no contact JSON API and no private fixture bundle loaded by the host.
- Browser same-origin policy makes the iframe's `contentDocument` null and throws `SecurityError` when host JavaScript tries to read `contentWindow.document`.
- The provider sends no CORS grants. `Cross-Origin-Resource-Policy: same-origin` also blocks the host from embedding provider avatars directly as images.
- CSP allows embedding only by the configured host origin and restricts iframe scripts, styles, and images to provider resources. The iframe is sandboxed with `allow-scripts allow-same-origin`, which preserves its separate provider origin.
- Props are allowlisted. Updates navigate the iframe, resetting local search and selection state. No arbitrary CSS, HTML, callbacks, or resource URLs cross into it.
- Frame dimensions depend only on public props, never on names, search results, or list length. There are no resize or readiness messages. Lists use a fixed viewport and scroll internally.
- Selection messages are checked against the exact provider origin, iframe window, channel, protocol version, and payload shape. The callback receives just a handle.
- The two allowed commands use `postMessage` with the exact provider target origin. The provider validates the parent origin, source window, channel, and exact schema before acting. Results must match a pending request ID and action; duplicates and unsolicited results are ignored. Commands preserve the iframe document and private search state.
- The development host explicitly denies access to provider source through Vite filesystem routes.

Selection events contain no contact details:

```json
{
  "protocol": "opaque-ui",
  "version": 1,
  "type": "select",
  "channel": "frame-instance-id",
  "handle": "ct_7hk2"
}
```

Commands and their acknowledgments have the same fields. The result changes only `type` to `"action-result"`:

```json
{
  "protocol": "opaque-ui",
  "version": 1,
  "type": "command",
  "channel": "frame-instance-id",
  "request_id": "rq_829b47b5-faa1-4f71-a535-e028f8b0d128",
  "action": "clear-selection"
}
```

`onMessage` reports actual sent commands and validated incoming messages. The demo retains the last eight entries. Search text, names, image URLs, and result counts never appear in these messages.

## Scope of the privacy claim

The default separate-origin mode demonstrates isolation from **JavaScript running in the host page**. The browser user, accessibility tools, extensions with sufficient permissions, screenshots, and an external HTTP client can still see rendered information. The demo provider is unauthenticated, so the host's backend could fetch it directly. Opaque handles and CORS are not access control. The same-site Pages demo has the additional limitations described above.

Before using real data, the provider needs authentication, authorization scoped to each handle and embedding app, and a supported cross-site session strategy. Different localhost ports demonstrate different origins, but do not reproduce third-party cookie restrictions. Fixed geometry reduces one disclosure path; this prototype does not claim to eliminate every timing or other side channel.

Relevant browser documentation: [same-origin policy](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy), [postMessage validation](https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage#security_concerns), [CORP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Cross-Origin_Resource_Policy), and [CSP frame-ancestors](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/frame-ancestors).

## Verify

```sh
npm test
npm run test:e2e
npm run build
npm run format:check
```

Browser tests use an installed Google Chrome and start both development servers when needed. They check actual iframe rendering, blocked DOM and network access, visibility props, themes, private search, both messaging directions, rejection of invalid messages, fixed geometry, and a narrow viewport. They also compare logged payloads with actual browser traffic and verify that commands preserve the iframe document and search state. Each test checks for uncaught browser errors.

To test the built package, host, and provider together, stop `npm run dev` first:

```sh
npm run build
TEST_PRODUCTION=1 npm run test:e2e
```

To serve the built demo, use `npm run preview`.

## Source layout

| Location               | Responsibility                                             |
| ---------------------- | ---------------------------------------------------------- |
| `packages/react`       | Public React API, iframe wrapper, and message validation   |
| `apps/host`            | Interactive playground and live host-side inspector        |
| `apps/provider/src`    | Private fictional records, HTML rendering, and HTTP policy |
| `apps/provider/public` | Provider CSS and private list interaction script           |
| `apps/provider/static` | Static iframe HTML shell for the same-site Pages demo      |
| `tests/unit`           | Package API and protocol validation                        |
| `tests/integration`    | Provider behavior, input validation, and HTTP headers      |
| `tests/e2e`            | Real browser isolation and component behavior              |

The provider accepts `HOST_ORIGIN` and `PROVIDER_PORT` environment variables. To move either origin, also update the host's provider URL and Vite port configuration. Provider and host must remain on different origins.

DM Sans and Manrope are distributed under the SIL Open Font License. Their license files are included beside the local font assets.
