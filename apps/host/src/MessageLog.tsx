import { useEffect, useRef } from 'react'
import type { ContactMessageEntry } from '@opaque-ui/react'

export type LoggedMessage = ContactMessageEntry & { id: number }

export default function MessageLog({
  messages,
  active,
  onTryMessaging,
  onClear,
}: {
  messages: LoggedMessage[]
  active: boolean
  onTryMessaging: () => void
  onClear: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = scrollRef.current
    if (container) container.scrollTop = container.scrollHeight
  }, [messages])

  return (
    <section className="event-log" aria-label="Event log">
      <div className="event-heading">
        <h3>Event log</h3>
        {messages.length > 0 ? (
          <button onClick={onClear}>Clear log</button>
        ) : (
          <span>WAITING FOR AN ACTION</span>
        )}
      </div>
      {messages.length > 0 ? (
        <div className="event-messages" ref={scrollRef}>
          {messages.map(({ id, direction, message }) => (
            <div className={`event-entry ${direction}`} key={id}>
              <div className="event-meta">
                <span>
                  {direction === 'host-to-iframe'
                    ? 'Host → iframe'
                    : 'Iframe → host'}
                </span>
                <code>{message.type}</code>
              </div>
              <pre>{JSON.stringify(message, null, 2)}</pre>
            </div>
          ))}
        </div>
      ) : (
        <p className="event-empty">
          {active
            ? 'Select a contact or send a command. The actual messages appear here.'
            : 'Explore two-way messaging with the Contact list.'}
          {!active && <button onClick={onTryMessaging}>Try messaging →</button>}
        </p>
      )}
      {messages.length > 0 && (
        <p className="event-footnote">
          Last 8 messages · Handles and action metadata only
        </p>
      )}
    </section>
  )
}
