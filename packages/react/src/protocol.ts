export type AvatarSize = 'small' | 'medium' | 'large'
export type ContactDensity = 'comfortable' | 'compact'
export type ContactTheme = 'light' | 'dark'
export type ContactListAction = 'focus-search' | 'clear-selection'

interface ContactMessage {
  protocol: 'opaque-ui'
  version: 1
  channel: string
}

export interface ContactSelectionMessage extends ContactMessage {
  type: 'select'
  handle: string
}

export interface ContactCommandMessage extends ContactMessage {
  type: 'command'
  request_id: string
  action: ContactListAction
}

export interface ContactActionResultMessage extends Omit<
  ContactCommandMessage,
  'type'
> {
  type: 'action-result'
}

export type ContactMessageEntry =
  | { direction: 'host-to-iframe'; message: ContactCommandMessage }
  | {
      direction: 'iframe-to-host'
      message: ContactSelectionMessage | ContactActionResultMessage
    }

export interface ContactListCallbacks {
  onSelect?: (handle: string) => void
  onAction?: (action: ContactListAction) => void
  onMessage?: (entry: ContactMessageEntry) => void
}

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
const actionKeys = [
  'protocol',
  'version',
  'type',
  'channel',
  'request_id',
  'action',
]
const actions = ['focus-search', 'clear-selection']
type FrameEvent = Pick<MessageEvent<unknown>, 'origin' | 'source' | 'data'>

function readFrameMessage(
  event: FrameEvent,
  expected: ExpectedFrame,
  allowedKeys: string[],
): Record<string, unknown> | null {
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
    keys.length !== allowedKeys.length ||
    !allowedKeys.every((key) => keys.includes(key))
  ) {
    return null
  }
  const message = payload as Record<string, unknown>
  if (
    message.protocol !== 'opaque-ui' ||
    message.version !== 1 ||
    message.channel !== expected.channel
  ) {
    return null
  }
  return message
}

export function getSelectedHandle(
  event: FrameEvent,
  expected: ExpectedFrame,
): string | null {
  const selection = readFrameMessage(event, expected, selectionKeys)
  if (
    !selection ||
    selection.type !== 'select' ||
    typeof selection.handle !== 'string' ||
    !/^ct_[a-z0-9]+$/.test(selection.handle)
  ) {
    return null
  }
  return selection.handle
}

export function createListMessenger(
  expected: ExpectedFrame,
  callbacks: ContactListCallbacks,
) {
  const pending = new Map<string, ContactListAction>()
  let active = true

  return {
    send(action: ContactListAction) {
      if (!active || !expected.source || !actions.includes(action)) return
      const message: ContactCommandMessage = {
        protocol: 'opaque-ui',
        version: 1,
        type: 'command',
        channel: expected.channel,
        request_id: `rq_${crypto.randomUUID()}`,
        action,
      }
      expected.source.postMessage(message, expected.origin)
      pending.set(message.request_id, action)
      if (pending.size > 32) pending.delete(pending.keys().next().value!)
      callbacks.onMessage?.({ direction: 'host-to-iframe', message })
    },
    receive(event: FrameEvent) {
      if (!active) return
      const handle = getSelectedHandle(event, expected)
      if (handle !== null) {
        callbacks.onMessage?.({
          direction: 'iframe-to-host',
          message: event.data as ContactSelectionMessage,
        })
        callbacks.onSelect?.(handle)
        return
      }
      const result = readFrameMessage(event, expected, actionKeys)
      if (
        !result ||
        result.type !== 'action-result' ||
        typeof result.request_id !== 'string' ||
        !/^[A-Za-z0-9_:-]{1,128}$/.test(result.request_id) ||
        typeof result.action !== 'string' ||
        !actions.includes(result.action) ||
        pending.get(result.request_id) !== result.action
      ) {
        return
      }
      pending.delete(result.request_id)
      callbacks.onMessage?.({
        direction: 'iframe-to-host',
        message: event.data as ContactActionResultMessage,
      })
      callbacks.onAction?.(result.action as ContactListAction)
    },
    dispose() {
      active = false
      pending.clear()
    },
  }
}
