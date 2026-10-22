import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
} from 'react'
import type { ForwardedRef, ReactNode } from 'react'
import {
  createEmbedUrl,
  createListMessenger,
  normalizeEmbedPath,
  normalizeProviderOrigin,
} from './protocol.js'
import type {
  AvatarSize,
  ContactDensity,
  ContactIsolation,
  ContactListCallbacks,
  ContactTheme,
  EmbedConfiguration,
} from './protocol.js'

export type {
  AvatarSize,
  ContactDensity,
  ContactIsolation,
  ContactListAction,
  ContactMessageEntry,
  ContactTheme,
} from './protocol.js'

export interface ContactProviderProps {
  origin: string
  isolation?: ContactIsolation
  embedPath?: string
  children: ReactNode
}

export interface AvatarProps {
  contact_id: string
  size?: AvatarSize
  theme?: ContactTheme
}

export interface ContactProps {
  contact_id: string
  avatar?: boolean
  username?: boolean
  density?: ContactDensity
  theme?: ContactTheme
}

export interface ContactListProps extends ContactListCallbacks {
  list_id: string
  avatar?: boolean
  username?: boolean
  density?: ContactDensity
  theme?: ContactTheme
}

export interface ContactListRef {
  focusSearch(): void
  clearSelection(): void
}

const ProviderConfiguration = createContext<{
  origin: string
  isolation: ContactIsolation
  embedPath: string
} | null>(null)
const avatarSizes = { small: 40, medium: 56, large: 88 }
const frameTitles = {
  avatar: 'Private avatar',
  contact: 'Private contact',
  list: 'Private contact list',
}

export function ContactProvider({
  origin,
  isolation = 'origin',
  embedPath = '/embed',
  children,
}: ContactProviderProps) {
  const providerOrigin = normalizeProviderOrigin(
    origin,
    typeof window === 'undefined' ? undefined : window.location.origin,
    isolation,
  )
  return (
    <ProviderConfiguration.Provider
      value={{
        origin: providerOrigin,
        isolation,
        embedPath: normalizeEmbedPath(embedPath),
      }}
    >
      {children}
    </ProviderConfiguration.Provider>
  )
}

function PrivateFrame({
  onSelect,
  onAction,
  onMessage,
  listRef,
  ...configuration
}: EmbedConfiguration &
  ContactListCallbacks & { listRef?: ForwardedRef<ContactListRef> }) {
  const provider = useContext(ProviderConfiguration)
  const expectedOrigin =
    provider?.isolation === 'sandbox' ? 'null' : provider?.origin
  const frame = useRef<HTMLIFrameElement>(null)
  const channel = useId()
  const [parentOrigin, setParentOrigin] = useState<string | null>(null)
  const messenger = useRef<ReturnType<typeof createListMessenger> | null>(null)
  const callbacks = useRef({ onSelect, onAction, onMessage })
  const src =
    provider && parentOrigin
      ? createEmbedUrl(
          provider.origin,
          parentOrigin,
          channel,
          configuration,
          provider.embedPath,
        )
      : undefined

  useEffect(() => {
    setParentOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    callbacks.current = { onSelect, onAction, onMessage }
  }, [onSelect, onAction, onMessage])

  useEffect(() => {
    if (!expectedOrigin || !src || configuration.component !== 'list') return
    const connection = createListMessenger(
      {
        origin: expectedOrigin,
        source: frame.current?.contentWindow ?? null,
        channel,
      },
      {
        onSelect: (handle) => callbacks.current.onSelect?.(handle),
        onAction: (action) => callbacks.current.onAction?.(action),
        onMessage: (entry) => callbacks.current.onMessage?.(entry),
      },
    )
    messenger.current = connection
    window.addEventListener('message', connection.receive)
    return () => {
      connection.dispose()
      messenger.current = null
      window.removeEventListener('message', connection.receive)
    }
  }, [expectedOrigin, src, channel, configuration.component])

  useImperativeHandle(
    listRef,
    () => ({
      focusSearch: () => messenger.current?.send('focus-search'),
      clearSelection: () => messenger.current?.send('clear-selection'),
    }),
    [],
  )

  if (!provider)
    throw new Error(
      'Private contact components must be wrapped in a ContactProvider.',
    )

  const { component, size, density } = configuration
  const width =
    component === 'avatar'
      ? avatarSizes[size]
      : component === 'contact'
        ? 320
        : 360
  const height =
    component === 'avatar'
      ? avatarSizes[size]
      : component === 'list'
        ? 360
        : density === 'compact'
          ? 68
          : 88

  return (
    <iframe
      key={provider.isolation}
      ref={frame}
      src={src}
      title={frameTitles[component]}
      data-private-component={component}
      width={width}
      height={height}
      sandbox={
        provider.isolation === 'sandbox'
          ? 'allow-scripts'
          : 'allow-scripts allow-same-origin'
      }
      referrerPolicy="no-referrer"
      style={{ display: 'block', width, maxWidth: '100%', height, border: 0 }}
    />
  )
}

export function Avatar({
  contact_id,
  size = 'medium',
  theme = 'light',
}: AvatarProps) {
  return (
    <PrivateFrame
      component="avatar"
      handle={contact_id}
      avatar
      username={false}
      density="comfortable"
      theme={theme}
      size={size}
    />
  )
}

export function Contact({
  contact_id,
  avatar = true,
  username = true,
  density = 'comfortable',
  theme = 'light',
}: ContactProps) {
  return (
    <PrivateFrame
      component="contact"
      handle={contact_id}
      avatar={avatar}
      username={username}
      density={density}
      theme={theme}
      size="medium"
    />
  )
}

export const ContactList = forwardRef<ContactListRef, ContactListProps>(
  function ContactList(
    {
      list_id,
      avatar = true,
      username = true,
      density = 'comfortable',
      theme = 'light',
      onSelect,
      onAction,
      onMessage,
    },
    ref,
  ) {
    return (
      <PrivateFrame
        component="list"
        handle={list_id}
        avatar={avatar}
        username={username}
        density={density}
        theme={theme}
        size="small"
        onSelect={onSelect}
        onAction={onAction}
        onMessage={onMessage}
        listRef={ref}
      />
    )
  },
)
