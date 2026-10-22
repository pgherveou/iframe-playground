import {
  createContext,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react'
import type { ReactNode } from 'react'
import {
  createEmbedUrl,
  getSelectedHandle,
  normalizeProviderOrigin,
} from './protocol.js'
import type {
  AvatarSize,
  ContactDensity,
  ContactTheme,
  EmbedConfiguration,
} from './protocol.js'

export type { AvatarSize, ContactDensity, ContactTheme } from './protocol.js'

export interface ContactProviderProps {
  origin: string
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

export interface ContactListProps {
  list_id: string
  avatar?: boolean
  username?: boolean
  density?: ContactDensity
  theme?: ContactTheme
  onSelect?: (handle: string) => void
}

const ProviderOrigin = createContext<string | null>(null)
const avatarSizes = { small: 40, medium: 56, large: 88 }
const frameTitles = {
  avatar: 'Private avatar',
  contact: 'Private contact',
  list: 'Private contact list',
}

export function ContactProvider({ origin, children }: ContactProviderProps) {
  const providerOrigin = normalizeProviderOrigin(
    origin,
    typeof window === 'undefined' ? undefined : window.location.origin,
  )
  return (
    <ProviderOrigin.Provider value={providerOrigin}>
      {children}
    </ProviderOrigin.Provider>
  )
}

function PrivateFrame({
  onSelect,
  ...configuration
}: EmbedConfiguration & { onSelect?: (handle: string) => void }) {
  const origin = useContext(ProviderOrigin)
  const frame = useRef<HTMLIFrameElement>(null)
  const channel = useId()
  const [parentOrigin, setParentOrigin] = useState<string | null>(null)

  useEffect(() => {
    setParentOrigin(window.location.origin)
  }, [])

  useEffect(() => {
    if (!origin || !onSelect) return
    const receiveSelection = (event: MessageEvent<unknown>) => {
      const handle = getSelectedHandle(event, {
        origin,
        source: frame.current?.contentWindow ?? null,
        channel,
      })
      if (handle !== null) onSelect(handle)
    }
    window.addEventListener('message', receiveSelection)
    return () => window.removeEventListener('message', receiveSelection)
  }, [origin, onSelect, channel])

  if (!origin)
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
      ref={frame}
      src={
        parentOrigin
          ? createEmbedUrl(origin, parentOrigin, channel, configuration)
          : undefined
      }
      title={frameTitles[component]}
      data-private-component={component}
      width={width}
      height={height}
      sandbox="allow-scripts allow-same-origin"
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

export function ContactList({
  list_id,
  avatar = true,
  username = true,
  density = 'comfortable',
  theme = 'light',
  onSelect,
}: ContactListProps) {
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
    />
  )
}
