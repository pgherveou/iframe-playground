export type AvatarSize = 'small' | 'medium' | 'large'
export type ContactDensity = 'comfortable' | 'compact'
export type ContactTheme = 'light' | 'dark'

export interface EmbedConfiguration {
  component: 'avatar' | 'contact' | 'list'
  handle: string
  avatar: boolean
  username: boolean
  density: ContactDensity
  theme: ContactTheme
  size: AvatarSize
}

export function normalizeProviderOrigin(value: string, parentOrigin?: string) {
  const url = new URL(value)
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.pathname !== '/' ||
    url.search ||
    url.hash
  ) {
    throw new Error(
      'ContactProvider requires an HTTP or HTTPS origin without a path or credentials.',
    )
  }
  if (url.origin === parentOrigin) {
    throw new Error(
      'ContactProvider must use a separate origin to protect the iframe content.',
    )
  }
  return url.origin
}

export function createEmbedUrl(
  origin: string,
  parentOrigin: string,
  channel: string,
  configuration: EmbedConfiguration,
) {
  const url = new URL('/embed', origin)
  url.search = new URLSearchParams({
    component: configuration.component,
    handle: configuration.handle,
    avatar: String(configuration.avatar),
    username: String(configuration.username),
    density: configuration.density,
    theme: configuration.theme,
    size: configuration.size,
    parent_origin: parentOrigin,
    channel,
  }).toString()
  return url.href
}

interface ExpectedFrame {
  origin: string
  source: Window | null
  channel: string
}

const selectionKeys = ['protocol', 'version', 'type', 'channel', 'handle']

export function getSelectedHandle(
  event: Pick<MessageEvent<unknown>, 'origin' | 'source' | 'data'>,
  expected: ExpectedFrame,
): string | null {
  if (
    !expected.source ||
    event.source !== expected.source ||
    event.origin !== expected.origin
  ) {
    return null
  }
  const payload = event.data
  if (!payload || typeof payload !== 'object' || Array.isArray(payload))
    return null
  const keys = Reflect.ownKeys(payload)
  if (
    keys.length !== selectionKeys.length ||
    !selectionKeys.every((key) => keys.includes(key))
  ) {
    return null
  }
  const selection = payload as Record<string, unknown>
  if (
    selection.protocol !== 'opaque-ui' ||
    selection.version !== 1 ||
    selection.type !== 'select' ||
    selection.channel !== expected.channel ||
    typeof selection.handle !== 'string' ||
    !/^ct_[a-z0-9]+$/.test(selection.handle)
  ) {
    return null
  }
  return selection.handle
}
