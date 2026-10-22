import type { EmbedConfig } from './config.js'
import { findContact, findList, type ContactRecord } from './contacts.js'

function AvatarImage({
  contact,
  avatarBase,
}: {
  contact: ContactRecord
  avatarBase: string
}) {
  return (
    <img
      className="avatar-image"
      src={`${avatarBase}/${contact.handle}.svg`}
      alt="Contact avatar"
    />
  )
}

function ContactInfo({
  contact,
  config,
  avatarBase,
}: {
  contact: ContactRecord
  config: EmbedConfig
  avatarBase: string
}) {
  return (
    <>
      {config.avatar && (
        <AvatarImage contact={contact} avatarBase={avatarBase} />
      )}
      {config.username && (
        <span className="contact-info">
          <span className="contact-name">{contact.name}</span>
          <span className="contact-username">{contact.username}</span>
        </span>
      )}
      {!config.avatar && !config.username && (
        <span className="private-contact">Private contact</span>
      )}
    </>
  )
}

function ContactList({
  config,
  avatarBase,
}: {
  config: EmbedConfig
  avatarBase: string
}) {
  const contacts = findList(config.handle)
  if (!contacts) return <Unavailable component="list" />

  return (
    <section className="contact-list" aria-label="Contact list">
      <header className="list-heading">
        <h1>Your people</h1>
        <span className="contact-count">{contacts.length} contacts</span>
      </header>
      <div className="search-wrapper">
        <svg className="search-icon" viewBox="0 0 20 20" aria-hidden="true">
          <circle cx="8.5" cy="8.5" r="5.5" />
          <path d="m13 13 4 4" />
        </svg>
        <input
          type="search"
          aria-label="Search contacts"
          placeholder="Find someone…"
          autoComplete="off"
        />
      </div>
      <div className="contact-rows">
        {contacts.map((contact) => (
          <button
            type="button"
            className="contact-row"
            data-contact-row=""
            data-handle={contact.handle}
            data-search={`${contact.name} ${contact.username}`}
            key={contact.handle}
            aria-pressed="false"
          >
            <ContactInfo
              contact={contact}
              config={config}
              avatarBase={avatarBase}
            />
            <span className="selection-mark" aria-hidden="true">
              ✓
            </span>
          </button>
        ))}
        <p className="no-results" hidden>
          No contacts found
        </p>
      </div>
      <footer className="list-footer">
        <span className="privacy-dot" />
        Only handles and action confirmations leave
      </footer>
    </section>
  )
}

function Unavailable({ component }: { component: EmbedConfig['component'] }) {
  return (
    <div className={`unavailable unavailable-${component}`} role="status">
      {component === 'list' ? 'List unavailable' : 'Contact unavailable'}
    </div>
  )
}

export function EmbedContent({
  config,
  avatarBase = '/avatars',
}: {
  config: EmbedConfig
  avatarBase?: string
}) {
  if (config.component === 'list')
    return <ContactList config={config} avatarBase={avatarBase} />
  const contact = findContact(config.handle)
  if (!contact) return <Unavailable component={config.component} />
  if (config.component === 'avatar')
    return (
      <div className="standalone-avatar">
        <AvatarImage contact={contact} avatarBase={avatarBase} />
      </div>
    )
  return (
    <div className="contact-card">
      <ContactInfo contact={contact} config={config} avatarBase={avatarBase} />
    </div>
  )
}
