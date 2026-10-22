# @opaque-ui/react

React components that let a separate-origin provider render private contact data inside iframes. The host supplies opaque handles and presentation props.

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

The provider origin is required and must differ from the host origin. The provider must support the `/embed` route and allow the host origin. This prototype package does not include provider authentication.

| Component         | Props                                                                                                                                    |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `ContactProvider` | Required `origin` and `children`                                                                                                         |
| `Avatar`          | Required `contact_id`; `size`: `small`, `medium` (default), or `large`; `theme`: `light` (default) or `dark`                             |
| `Contact`         | Required `contact_id`; `avatar` and `username` default to `true`; `density`: `comfortable` (default) or `compact`; `theme`               |
| `ContactList`     | Required `list_id`; same presentation props as `Contact`; optional `ref`, `onSelect(handle)`, `onAction(action)`, and `onMessage(entry)` |

Presentation changes navigate the iframe. Avatar dimensions are 40, 56, or 88 pixels. Contact cards are 320 pixels wide and 88 pixels tall, or 68 pixels tall when compact. Lists use a fixed 360 × 360 pixel viewport. Widths shrink to fit the parent.

Selection delivers only an opaque contact handle after validating the sender's origin, frame window, channel, and exact message schema. No names, avatar URLs, or content measurements are returned. Server rendering emits fixed iframe shells; the source is attached after hydration once the host origin is known.

`ContactListRef` exposes `focusSearch()` and `clearSelection()`. These send allowlisted commands without navigating the iframe. Clearing selection preserves the private search query and displayed results. `onAction` reports the corresponding `ContactListAction`, either `'focus-search'` or `'clear-selection'`, after a matching provider acknowledgment arrives. Calling a ref method before the iframe is initialized has no effect.

`onMessage` receives a `ContactMessageEntry` with `direction` (`'host-to-iframe'` or `'iframe-to-host'`) and the actual posted or accepted `message`. Command messages contain exactly `protocol`, `version`, `type: 'command'`, `channel`, `request_id`, and `action`. Acknowledgments use the same shape with `type: 'action-result'`. Selection messages contain exactly `protocol`, `version`, `type: 'select'`, `channel`, and `handle`. The protocol is `'opaque-ui'`, version `1`.

Commands use the configured provider as the exact target origin. Incoming messages must match that origin, the iframe window, the channel, and an exact schema. An acknowledgment must also match a pending request and action; unsolicited and duplicate results are ignored. The wrapper tracks at most 32 outstanding commands and discards them when presentation props navigate the frame or it unmounts. There is no arbitrary messaging API, and no ready or resize messages are emitted.

The browser's same-origin policy prevents host scripts from reading iframe content. The provider must separately authorize data access before this architecture is used with real personal data.
