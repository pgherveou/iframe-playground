import type { ReactNode } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { findContact, findList, type ContactRecord } from './contacts.js'

export interface EmbedConfig {
  component: 'avatar' | 'contact' | 'list'
  handle: string
  avatar: boolean
  username: boolean
  density: 'comfortable' | 'compact'
  theme: 'light' | 'dark'
  size: 'small' | 'medium' | 'large'
  parentOrigin: string
  channel: string
}

function AvatarImage({ contact }: { contact: ContactRecord }) {
  return (
    <img
      className="avatar-image"
      src={`/avatars/${contact.handle}.svg`}
      alt="Contact avatar"
    />
  )
}

function ContactInfo({
  contact,
  config,
}: {
  contact: ContactRecord
  config: EmbedConfig
}) {
  return (
    <>
      {config.avatar && <AvatarImage contact={contact} />}
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

function ContactList({ config }: { config: EmbedConfig }) {
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
            <ContactInfo contact={contact} config={config} />
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

export function renderEmbed(config: EmbedConfig) {
  const contact = findContact(config.handle)
  let content: ReactNode
  if (config.component === 'list') content = <ContactList config={config} />
  else if (!contact) content = <Unavailable component={config.component} />
  else if (config.component === 'avatar')
    content = (
      <div className="standalone-avatar">
        <AvatarImage contact={contact} />
      </div>
    )
  else
    content = (
      <div className="contact-card">
        <ContactInfo contact={contact} config={config} />
      </div>
    )

  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang="en" data-theme={config.theme}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Private contact component</title>
          <link rel="stylesheet" href="/component.css" />
        </head>
        <body
          className={`component-${config.component} density-${config.density} size-${config.size}`}
          data-channel={config.channel}
          data-parent-origin={config.parentOrigin}
        >
          {content}
          {config.component === 'list' && <script src="/component.js" />}
        </body>
      </html>,
    )
  )
}
