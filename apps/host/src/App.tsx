import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Avatar,
  Contact,
  ContactList,
  ContactProvider,
  type ContactListRef,
  type ContactMessageEntry,
} from '@opaque-ui/react'
import MessageLog, { type LoggedMessage } from './MessageLog'
import './styles.css'

const providerOrigin = 'http://localhost:5184'
type ComponentKind = 'contact' | 'avatar' | 'list'
type IconName =
  | 'window'
  | 'shield'
  | 'code'
  | 'arrow'
  | 'copy'
  | 'check'
  | 'user'
  | 'users'
  | 'sliders'
  | 'lock'
  | 'terminal'

function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    window: (
      <>
        <rect x="3" y="4" width="18" height="16" rx="3" />
        <path d="M3 9h18M7 6.5h.01M10 6.5h.01" />
      </>
    ),
    shield: (
      <>
        <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z" />
        <path d="m8.5 12 2.5 2.5 4.5-5" />
      </>
    ),
    code: (
      <>
        <path d="m8 7-5 5 5 5m8-10 5 5-5 5m-3-14-2 18" />
      </>
    ),
    arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    user: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21v-2a8 8 0 0 1 16 0v2" />
      </>
    ),
    users: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20v-2a6 6 0 0 1 12 0v2m2-15a3 3 0 0 1 0 6m1 3a5 5 0 0 1 3 4v2" />
      </>
    ),
    sliders: (
      <>
        <path d="M4 7h7m6 0h3M4 17h3m6 0h7" />
        <circle cx="14" cy="7" r="3" />
        <circle cx="10" cy="17" r="3" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="11" rx="3" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3m-4 4v3" />
      </>
    ),
    terminal: (
      <>
        <path d="m5 7 5 5-5 5m8 0h6" />
      </>
    ),
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {paths[name]}
    </svg>
  )
}

const components: {
  kind: ComponentKind
  label: string
  icon: IconName
  description: string
}[] = [
  {
    kind: 'contact',
    label: 'Contact',
    icon: 'user',
    description: 'A little context, without handing over an identity.',
  },
  {
    kind: 'avatar',
    label: 'Avatar',
    icon: 'user',
    description: 'A familiar face, resolved entirely inside the frame.',
  },
  {
    kind: 'list',
    label: 'Contact list',
    icon: 'users',
    description: 'Search and select privately. Receive only a handle.',
  },
]

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="toggle-row">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true" />
    </label>
  )
}

type Inspection = {
  status: 'blocked' | 'readable' | 'error'
  name: string
  detail: string
  documentIsNull: boolean
}

export default function App() {
  const [kind, setKind] = useState<ComponentKind>('contact')
  const [contactId, setContactId] = useState('ct_7hk2')
  const [listId, setListId] = useState('ls_4dn9')
  const [avatar, setAvatar] = useState(true)
  const [username, setUsername] = useState(true)
  const [theme, setTheme] = useState<'light' | 'dark'>('light')
  const [density, setDensity] = useState<'comfortable' | 'compact'>(
    'comfortable',
  )
  const [size, setSize] = useState<'small' | 'medium' | 'large'>('large')
  const [codeTab, setCodeTab] = useState<'react' | 'iframe'>('react')
  const [iframeMarkup, setIframeMarkup] = useState('')
  const [inspection, setInspection] = useState<Inspection | null>(null)
  const [selectedHandle, setSelectedHandle] = useState<string | null>(null)
  const [messages, setMessages] = useState<LoggedMessage[]>([])
  const listRef = useRef<ContactListRef>(null)
  const nextMessageId = useRef(0)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setSelectedHandle(null)
  }, [kind, listId, avatar, username, theme, density])

  function logMessage(entry: ContactMessageEntry) {
    const message = { ...entry, id: nextMessageId.current++ }
    setMessages((previous) => [...previous, message].slice(-8))
  }

  useEffect(() => {
    if (codeTab !== 'iframe') return
    const frame = document.querySelector('[data-private-component]')
    if (!frame) return
    const updateMarkup = () => setIframeMarkup(frame.outerHTML)
    updateMarkup()
    const observer = new MutationObserver(updateMarkup)
    observer.observe(frame, { attributes: true })
    return () => observer.disconnect()
  }, [codeTab, kind])

  const activeComponent = components.find(
    (component) => component.kind === kind,
  )!
  const componentName =
    kind === 'list' ? 'ContactList' : kind === 'avatar' ? 'Avatar' : 'Contact'
  const propLines =
    kind === 'avatar'
      ? `    contact_id="${contactId}"\n    size="${size}"`
      : `    ${kind === 'list' ? 'list_id' : 'contact_id'}="${kind === 'list' ? listId : contactId}"\n    avatar={${avatar}}\n    username={${username}}\n    density="${density}"`
  const source = `import { ${componentName}, ContactProvider } from '@opaque-ui/react'\n\n<ContactProvider origin="${providerOrigin}">\n  <${componentName}\n${propLines}\n    theme="${theme}"${kind === 'list' ? '\n    onSelect={(handle) => console.log(handle)}' : ''}\n  />\n</ContactProvider>`

  function testAccess() {
    const frame = document.querySelector<HTMLIFrameElement>(
      '[data-private-component]',
    )
    if (!frame?.contentWindow) {
      setInspection({
        status: 'error',
        name: 'Not ready',
        detail: 'Wait for the iframe to load, then try again.',
        documentIsNull: false,
      })
      return
    }
    try {
      const content = frame.contentWindow.document.body.innerText
      setInspection({
        status: 'readable',
        name: 'DOM readable',
        detail: `Read ${content.length} characters. The boundary is not active.`,
        documentIsNull: frame.contentDocument === null,
      })
    } catch (error) {
      const name = error instanceof DOMException ? error.name : 'Error'
      setInspection({
        status: name === 'SecurityError' ? 'blocked' : 'error',
        name,
        detail:
          name === 'SecurityError'
            ? 'The browser blocked access to the iframe document.'
            : 'The check did not finish. Please try again.',
        documentIsNull: frame.contentDocument === null,
      })
    }
  }

  function showIframe() {
    const frame = document.querySelector<HTMLIFrameElement>(
      '[data-private-component]',
    )
    setIframeMarkup(frame?.outerHTML ?? 'The iframe is loading.')
    setCodeTab('iframe')
  }

  async function copyCode() {
    try {
      await navigator.clipboard.writeText(
        codeTab === 'react' ? source : iframeMarkup,
      )
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setCopied(false)
    }
  }

  function changeComponent(next: ComponentKind) {
    setKind(next)
    setCodeTab('react')
    setInspection(null)
  }

  return (
    <ContactProvider origin={providerOrigin}>
      <div className="app-shell">
        <header className="site-header">
          <a className="brand" href="#" aria-label="Opaque UI home">
            <span className="brand-mark">
              <span />
              <span />
            </span>
            <span>
              opaque<span className="brand-slash">/</span>ui
            </span>
            <span className="lab-badge">LAB</span>
          </a>
          <nav aria-label="Main navigation">
            <a className="active" href="#playground">
              Playground
            </a>
            <a href="#boundary">The boundary</a>
          </nav>
          <span className="local-status">
            <span className="status-dot" />
            Local prototype<span className="version">v0.1</span>
          </span>
        </header>

        <main>
          <section className="intro">
            <div className="eyebrow">
              <span className="mini-line" />
              PRIVATE BY COMPOSITION
            </div>
            <h1>
              Identity, without exposure<span>.</span>
            </h1>
            <p>
              Give your app a familiar face. Keep the personal data private.
              <br className="desktop-break" /> Real components, rendered across
              an iframe boundary.
            </p>
            <div className="intro-note">
              <Icon name="shield" size={16} />
              Visible to people. Isolated from your page.
            </div>
          </section>

          <section
            className="playground panel"
            id="playground"
            aria-label="Component playground"
          >
            <div className="playground-heading">
              <div>
                <span className="section-number">01</span>
                <h2>Component playground</h2>
              </div>
              <span className="subtle-label">CHANGE A PROP. SEE IT LIVE.</span>
            </div>
            <div className="component-tabs" aria-label="Component type">
              {components.map((component) => (
                <button
                  key={component.kind}
                  className={
                    kind === component.kind
                      ? 'component-tab selected'
                      : 'component-tab'
                  }
                  aria-pressed={kind === component.kind}
                  onClick={() => changeComponent(component.kind)}
                >
                  <Icon name={component.icon} size={16} />
                  {component.label}
                  {component.kind === kind && <span className="tab-dot" />}
                </button>
              ))}
            </div>

            <div className="playground-body">
              <div className="preview-area">
                <div className="preview-toolbar">
                  <span>
                    <Icon name="window" size={15} />
                    What your users see
                  </span>
                  <span className="live-label">
                    <span className="status-dot" />
                    LIVE IFRAME
                  </span>
                </div>
                <div
                  className={`preview-stage ${kind === 'list' ? 'list-stage' : ''}`}
                >
                  <div className="isolated-region">
                    <div
                      className={`frame-mount ${kind === 'avatar' ? 'avatar-mount' : ''}`}
                    >
                      {kind === 'contact' && (
                        <Contact
                          contact_id={contactId}
                          avatar={avatar}
                          username={username}
                          density={density}
                          theme={theme}
                        />
                      )}
                      {kind === 'avatar' && (
                        <Avatar
                          contact_id={contactId}
                          size={size}
                          theme={theme}
                        />
                      )}
                      {kind === 'list' && (
                        <ContactList
                          ref={listRef}
                          list_id={listId}
                          avatar={avatar}
                          username={username}
                          density={density}
                          theme={theme}
                          onSelect={setSelectedHandle}
                          onAction={(action) => {
                            if (action === 'clear-selection')
                              setSelectedHandle(null)
                          }}
                          onMessage={logMessage}
                        />
                      )}
                    </div>
                    <div className="frame-caption">
                      <span className="boundary-mark" />
                      One iframe. Its own document.
                    </div>
                  </div>
                </div>
                <div className="preview-description">
                  <span>{activeComponent.description}</span>
                  <span className="tag">&lt;{componentName} /&gt;</span>
                </div>
              </div>

              <aside className="props-panel" aria-label="Component props">
                <div className="props-heading">
                  <h3>Props</h3>
                  <Icon name="sliders" size={17} />
                </div>
                <label className="field-label" htmlFor="handle">
                  {kind === 'list' ? 'List handle' : 'Contact handle'}
                  <span aria-hidden="true">OPAQUE</span>
                </label>
                <select
                  className="handle-select"
                  id="handle"
                  value={kind === 'list' ? listId : contactId}
                  onChange={(event) =>
                    kind === 'list'
                      ? setListId(event.target.value)
                      : setContactId(event.target.value)
                  }
                >
                  {kind === 'list' ? (
                    <>
                      <option value="ls_4dn9">ls_4dn9</option>
                      <option value="ls_6ty2">ls_6ty2</option>
                      <option value="ls_missing">ls_missing</option>
                    </>
                  ) : (
                    <>
                      <option value="ct_7hk2">ct_7hk2</option>
                      <option value="ct_9pw4">ct_9pw4</option>
                      <option value="ct_2rn8">ct_2rn8</option>
                      <option value="ct_missing">ct_missing</option>
                    </>
                  )}
                </select>
                <p className="field-help">
                  A reference, with no identity attached.
                </p>
                {kind !== 'avatar' && (
                  <div className="toggle-group">
                    <Toggle
                      label="Show avatar"
                      checked={avatar}
                      onChange={setAvatar}
                    />
                    <Toggle
                      label="Show username"
                      checked={username}
                      onChange={setUsername}
                    />
                  </div>
                )}
                <div className="appearance-fields">
                  <label>
                    Theme
                    <select
                      value={theme}
                      onChange={(event) =>
                        setTheme(event.target.value as 'light' | 'dark')
                      }
                    >
                      <option value="light">Light</option>
                      <option value="dark">Dark</option>
                    </select>
                  </label>
                  {kind === 'avatar' ? (
                    <label>
                      Size
                      <select
                        value={size}
                        onChange={(event) =>
                          setSize(event.target.value as typeof size)
                        }
                      >
                        <option value="small">Small</option>
                        <option value="medium">Medium</option>
                        <option value="large">Large</option>
                      </select>
                    </label>
                  ) : (
                    <label>
                      Density
                      <select
                        value={density}
                        onChange={(event) =>
                          setDensity(event.target.value as typeof density)
                        }
                      >
                        <option value="comfortable">Comfortable</option>
                        <option value="compact">Compact</option>
                      </select>
                    </label>
                  )}
                </div>
                <div className="props-note">
                  <Icon name="arrow" size={16} />
                  <p>
                    {kind === 'list'
                      ? 'Handles, presentation props, and explicit commands cross into the iframe.'
                      : 'Only this handle and these props cross into the iframe.'}
                  </p>
                </div>
              </aside>
            </div>
            <div
              className={`communication-area ${kind === 'list' ? 'with-controls' : ''}`}
            >
              {kind === 'list' && (
                <section className="host-controls" aria-label="Host controls">
                  <div className="host-controls-heading">
                    <h3>Host controls</h3>
                    <span>NO RELOAD</span>
                  </div>
                  <p>Send an action into the list. Its search stays private.</p>
                  <div className="command-buttons">
                    <button onClick={() => listRef.current?.focusSearch()}>
                      Focus search
                    </button>
                    <button onClick={() => listRef.current?.clearSelection()}>
                      Clear selection
                    </button>
                  </div>
                  <div className="selected-handle">
                    <span>Selected handle</span>
                    <output aria-label="Selected contact handle">
                      {selectedHandle ?? 'No contact selected'}
                    </output>
                  </div>
                  <section
                    className="selected-preview"
                    aria-label="Selected contact preview"
                  >
                    {selectedHandle ? (
                      <>
                        <Contact contact_id={selectedHandle} theme={theme} />
                        <p>
                          The host passes this handle to a new Contact iframe.
                        </p>
                      </>
                    ) : (
                      <p>
                        Select someone in the list to display their Contact
                        iframe here.
                      </p>
                    )}
                  </section>
                </section>
              )}
              <MessageLog
                messages={messages}
                active={kind === 'list'}
                onTryMessaging={() => changeComponent('list')}
                onClear={() => setMessages([])}
              />
            </div>
            <div className="public-input-bar">
              <span className="public-label">
                <Icon name="code" size={14} />
                HOST INPUT
              </span>
              <code>
                {kind === 'list' ? 'list_id' : 'contact_id'}
                <span>=</span>"{kind === 'list' ? listId : contactId}"
              </code>
              <span className="input-divider" />
              <span>No names. No image URLs. No contact records.</span>
            </div>
          </section>

          <div className="details-grid">
            <section
              className="panel integration-panel"
              id="integration"
              aria-label="Integration example"
            >
              <div className="panel-heading">
                <div>
                  <span className="section-number">02</span>
                  <h2>A component. A boundary.</h2>
                </div>
                <Icon name="code" size={18} />
              </div>
              <div className="code-toolbar">
                <div className="code-tabs">
                  <button
                    className={codeTab === 'react' ? 'selected' : ''}
                    onClick={() => setCodeTab('react')}
                  >
                    React
                  </button>
                  <button
                    className={codeTab === 'iframe' ? 'selected' : ''}
                    onClick={showIframe}
                  >
                    Rendered iframe
                  </button>
                </div>
                <button
                  className="copy-button"
                  onClick={copyCode}
                  aria-label={copied ? 'Copied' : 'Copy code'}
                >
                  <Icon name={copied ? 'check' : 'copy'} size={14} />
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="source-code">
                <pre>
                  <code>{codeTab === 'react' ? source : iframeMarkup}</code>
                </pre>
              </div>
              <div className="code-footer">
                <span className="package-symbol">◇</span>
                <code>@opaque-ui/react</code>
                <span>Same familiar React API.</span>
              </div>
            </section>

            <section
              className="panel boundary-panel"
              id="boundary"
              aria-label="Privacy inspector"
            >
              <div className="panel-heading">
                <div>
                  <span className="section-number">03</span>
                  <h2>Try crossing the boundary.</h2>
                </div>
                <Icon name="shield" size={18} />
              </div>
              <div className="inspector-body">
                <p>
                  The host can position the iframe. Can it read what’s inside?
                </p>
                <div className="attack-code">
                  <Icon name="terminal" size={15} />
                  <code>iframe.contentWindow.document</code>
                </div>
                <button className="test-button" onClick={testAccess}>
                  <Icon name="lock" size={15} />
                  Test DOM access
                  <Icon name="arrow" size={16} />
                </button>
                <div
                  className={`inspection-result ${inspection?.status ?? 'pending'}`}
                  aria-live="polite"
                >
                  {inspection ? (
                    <>
                      <div>
                        <Icon
                          name={
                            inspection.status === 'blocked'
                              ? 'shield'
                              : 'window'
                          }
                          size={16}
                        />
                        <strong>{inspection.name}</strong>
                        {inspection.status === 'blocked' && (
                          <span>ACCESS DENIED</span>
                        )}
                      </div>
                      <p>{inspection.detail}</p>
                      <code>
                        contentDocument →{' '}
                        {inspection.documentIsNull ? 'null' : 'available'}
                      </code>
                    </>
                  ) : (
                    <>
                      <div>
                        <span className="idle-dot" />
                        <strong>Browser-enforced isolation</strong>
                      </div>
                      <p>
                        Run a real DOM read from this page to test the boundary.
                      </p>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>

          <section className="flow-strip" aria-label="How it works">
            <div>
              <span className="flow-icon">
                <Icon name="code" size={20} />
              </span>
              <div>
                <strong>Your application</strong>
                <p>Pass a handle and presentation props</p>
              </div>
            </div>
            <span className="flow-arrow">
              <Icon name="arrow" />
            </span>
            <div>
              <span className="flow-icon private">
                <Icon name="lock" size={20} />
              </span>
              <div>
                <strong>The private provider</strong>
                <p>Resolve and render on its own origin</p>
              </div>
            </div>
            <span className="flow-arrow">
              <Icon name="arrow" />
            </span>
            <div>
              <span className="flow-icon">
                <Icon name="window" size={20} />
              </span>
              <div>
                <strong>A seamless interface</strong>
                <p>Visible UI, without access to its DOM</p>
              </div>
            </div>
          </section>
          <footer>
            <span className="footer-brand">
              opaque/ui<span>Explore the boundary.</span>
            </span>
            <p>
              Fictional data · Browser isolation demo · Production requires
              provider authentication
            </p>
          </footer>
        </main>
      </div>
    </ContactProvider>
  )
}
