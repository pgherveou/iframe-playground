# @opaque-ui/react

React components that let a separate-origin provider render private contact data inside iframes. The host supplies opaque handles and presentation props.

```tsx
import { Avatar, Contact, ContactList, ContactProvider } from '@opaque-ui/react'

export function People() {
  return (
    <ContactProvider origin="http://localhost:5184">
      <Avatar contact_id="ct_7hk2" size="large" />
      <Contact contact_id="ct_7hk2" username avatar />
      <ContactList
        list_id="ls_4dn9"
        onSelect={(handle) => console.log(handle)}
      />
    </ContactProvider>
  )
}
```

The provider origin is required and must differ from the host origin. The provider must support the `/embed` route and allow the host origin. This prototype package does not include provider authentication.

| Component         | Props                                                                                                                      |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `ContactProvider` | Required `origin` and `children`                                                                                           |
| `Avatar`          | Required `contact_id`; `size`: `small`, `medium` (default), or `large`; `theme`: `light` (default) or `dark`               |
| `Contact`         | Required `contact_id`; `avatar` and `username` default to `true`; `density`: `comfortable` (default) or `compact`; `theme` |
| `ContactList`     | Required `list_id`; same presentation props as `Contact`; optional `onSelect(handle)`                                      |

Presentation changes navigate the iframe. Avatar dimensions are 40, 56, or 88 pixels. Contact cards are 320 pixels wide and 88 pixels tall, or 68 pixels tall when compact. Lists use a fixed 360 × 360 pixel viewport. Widths shrink to fit the parent.

Selection delivers only an opaque contact handle after validating the sender's origin, frame window, channel, and exact message schema. No names, avatar URLs, or content measurements are returned. Server rendering emits fixed iframe shells; the source is attached after hydration once the host origin is known.

The browser's same-origin policy prevents host scripts from reading iframe content. The provider must separately authorize data access before this architecture is used with real personal data.
