import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import {
  Avatar,
  Contact,
  ContactList,
  ContactProvider,
} from '../../packages/react/src/index'
import {
  createEmbedUrl,
  createListMessenger,
  getSelectedHandle,
  normalizeProviderOrigin,
} from '../../packages/react/src/protocol'

const providerOrigin = 'https://private.example'
const frameWindow = {} as Window
const channel = 'instance-1'
const selection = {
  protocol: 'opaque-ui',
  version: 1,
  type: 'select',
  channel,
  handle: 'ct_k92x',
}

const selectionEvent = (overrides: Partial<MessageEvent<unknown>> = {}) => ({
  origin: providerOrigin,
  source: frameWindow,
  data: selection,
  ...overrides,
})

const createMessenger = () => {
  const postMessage = vi.fn()
  const source = { postMessage } as unknown as Window
  const callbacks = {
    onSelect: vi.fn(),
    onAction: vi.fn(),
    onMessage: vi.fn(),
  }
  const messenger = createListMessenger({ ...expectedFrame, source }, callbacks)
  const resultEvent = (command: Record<string, unknown>) => ({
    origin: providerOrigin,
    source,
    data: { ...command, type: 'action-result' },
  })
  return { messenger, postMessage, callbacks, resultEvent, source }
}

describe('list command boundary', () => {
  it('posts only an allowlisted command to the exact provider origin and logs what was sent', () => {
    const { messenger, postMessage, callbacks } = createMessenger()
    messenger.send('focus-search')
    const command = postMessage.mock.calls[0][0]

    expect({
      calls: postMessage.mock.calls,
      entries: callbacks.onMessage.mock.calls,
    }).toEqual({
      calls: [
        [
          {
            protocol: 'opaque-ui',
            version: 1,
            type: 'command',
            channel,
            request_id: expect.stringMatching(/^[A-Za-z0-9_:-]{1,128}$/),
            action: 'focus-search',
          },
          providerOrigin,
        ],
      ],
      entries: [[{ direction: 'host-to-iframe', message: command }]],
    })
  })

  it('reports a matching acknowledgment once and never exposes the payload through onAction', () => {
    const { messenger, postMessage, callbacks, resultEvent } = createMessenger()
    messenger.send('clear-selection')
    const event = resultEvent(postMessage.mock.calls[0][0])
    messenger.receive(event)
    messenger.receive(event)

    expect({
      actions: callbacks.onAction.mock.calls,
      incoming: callbacks.onMessage.mock.calls.slice(1),
    }).toEqual({
      actions: [['clear-selection']],
      incoming: [[{ direction: 'iframe-to-host', message: event.data }]],
    })
  })

  it.each<
    [
      string,
      { origin?: string; source?: Window; data?: Record<string, unknown> },
    ]
  >([
    ['wrong origin', { origin: 'https://other.example' }],
    ['another frame', { source: {} as Window }],
    ['wrong channel', { data: { channel: 'other-channel' } }],
    ['wrong action', { data: { action: 'clear-selection' } }],
    ['arbitrary action', { data: { action: 'read-search' } }],
    ['another request', { data: { request_id: 'rq_unknown' } }],
    ['nonstring request', { data: { request_id: 1 } }],
    ['private fields', { data: { search: 'private query' } }],
    ['extra fields', { data: { extra: null } }],
    ['wrong protocol', { data: { protocol: 'other' } }],
    ['wrong version', { data: { version: 2 } }],
  ])(
    'ignores a result with %s without consuming the valid pending request',
    (_, overrides) => {
      const { messenger, postMessage, callbacks, resultEvent } =
        createMessenger()
      messenger.send('focus-search')
      const event = resultEvent(postMessage.mock.calls[0][0])
      messenger.receive({
        ...event,
        ...overrides,
        data: { ...event.data, ...overrides.data },
      })
      const beforeValid = callbacks.onMessage.mock.calls.length
      messenger.receive(event)

      expect({ beforeValid, actions: callbacks.onAction.mock.calls }).toEqual({
        beforeValid: 1,
        actions: [['focus-search']],
      })
    },
  )

  it('ignores unsolicited acknowledgments', () => {
    const { messenger, callbacks, resultEvent } = createMessenger()
    messenger.receive(
      resultEvent({
        protocol: 'opaque-ui',
        version: 1,
        channel,
        request_id: 'rq_unknown',
        action: 'focus-search',
      }),
    )
    expect({
      actions: callbacks.onAction.mock.calls,
      messages: callbacks.onMessage.mock.calls,
    }).toEqual({ actions: [], messages: [] })
  })

  it('disposes pending requests and stops sending or receiving when a frame navigates or unmounts', () => {
    const { messenger, postMessage, callbacks, resultEvent } = createMessenger()
    messenger.send('focus-search')
    const event = resultEvent(postMessage.mock.calls[0][0])
    messenger.dispose()
    messenger.receive(event)
    messenger.send('clear-selection')
    expect({
      sent: postMessage.mock.calls.length,
      actions: callbacks.onAction.mock.calls,
      logs: callbacks.onMessage.mock.calls.length,
    }).toEqual({ sent: 1, actions: [], logs: 1 })
  })

  it('bounds pending requests while allowing the newest acknowledgment', () => {
    const { messenger, postMessage, callbacks, resultEvent } = createMessenger()
    for (let request = 0; request < 33; request += 1)
      messenger.send('focus-search')
    messenger.receive(resultEvent(postMessage.mock.calls[0][0]))
    messenger.receive(resultEvent(postMessage.mock.calls[32][0]))
    expect(callbacks.onAction.mock.calls).toEqual([['focus-search']])
  })

  it('logs accepted selections while preserving the handle-only callback', () => {
    const { messenger, callbacks, source } = createMessenger()
    messenger.receive(selectionEvent({ source }))
    expect({
      selections: callbacks.onSelect.mock.calls,
      messages: callbacks.onMessage.mock.calls,
    }).toEqual({
      selections: [['ct_k92x']],
      messages: [[{ direction: 'iframe-to-host', message: selection }]],
    })
  })

  it('does not log or track a command when posting fails', () => {
    const { messenger, postMessage, callbacks } = createMessenger()
    postMessage.mockImplementation(() => {
      throw new Error('closed frame')
    })
    expect(() => messenger.send('focus-search')).toThrow('closed frame')
    expect(callbacks.onMessage.mock.calls).toEqual([])
  })
})

const expectedFrame = { origin: providerOrigin, source: frameWindow, channel }

describe('selection boundary', () => {
  it('delivers only the opaque handle from the configured frame', () => {
    expect(getSelectedHandle(selectionEvent(), expectedFrame)).toBe('ct_k92x')
  })

  it.each([
    ['another origin', { origin: 'https://attacker.example' }],
    [
      'an origin with a deceptive suffix',
      { origin: `${providerOrigin}.attacker.example` },
    ],
    ['another frame on the correct origin', { source: {} as Window }],
    ['a detached frame', { source: null }],
    ['a different channel', { data: { ...selection, channel: 'instance-2' } }],
    ['another protocol', { data: { ...selection, protocol: 'other' } }],
    ['an unsupported version', { data: { ...selection, version: 2 } }],
    ['an unexpected event', { data: { ...selection, type: 'resize' } }],
    [
      'extra private data',
      { data: { ...selection, username: 'Private name' } },
    ],
    ['a missing field', { data: { ...selection, channel: undefined } }],
    ['a list handle', { data: { ...selection, handle: 'ls_j7mv' } }],
    [
      'a URL instead of a handle',
      { data: { ...selection, handle: 'https://private.example/a' } },
    ],
    ['a nonstring handle', { data: { ...selection, handle: 7 } }],
    ['a null payload', { data: null }],
    ['a string payload', { data: JSON.stringify(selection) }],
    ['an array payload', { data: [selection] }],
  ])('ignores %s', (_, overrides) => {
    expect(
      getSelectedHandle(selectionEvent(overrides), expectedFrame),
    ).toBeNull()
  })

  it('cannot accept a message before a frame window exists', () => {
    expect(
      getSelectedHandle(selectionEvent({ source: null }), {
        ...expectedFrame,
        source: null,
      }),
    ).toBeNull()
  })
})

describe('iframe configuration', () => {
  it('sends only explicit public props, handles, and routing metadata', () => {
    const url = new URL(
      createEmbedUrl(providerOrigin, 'https://host.example', channel, {
        component: 'contact',
        handle: 'ct_k92x',
        avatar: true,
        username: false,
        density: 'compact',
        theme: 'dark',
        size: 'medium',
      }),
    )

    expect({
      origin: url.origin,
      path: url.pathname,
      params: Object.fromEntries(url.searchParams),
    }).toEqual({
      origin: providerOrigin,
      path: '/embed',
      params: {
        component: 'contact',
        handle: 'ct_k92x',
        avatar: 'true',
        username: 'false',
        density: 'compact',
        theme: 'dark',
        size: 'medium',
        parent_origin: 'https://host.example',
        channel,
      },
    })
  })

  it('normalizes the provider origin before origin comparisons', () => {
    expect(normalizeProviderOrigin('https://PRIVATE.example:443/')).toBe(
      providerOrigin,
    )
  })

  it.each([
    'javascript:alert(1)',
    'data:text/html,hello',
    'https://private.example/embed',
    'https://user:password@private.example',
    'https://private.example?query=1',
    'https://private.example#hash',
  ])(
    'rejects provider configuration that is not a clean HTTP origin: %s',
    (origin) => {
      expect(() => normalizeProviderOrigin(origin)).toThrow()
    },
  )

  it('rejects same-origin embedding because it would expose private DOM', () => {
    expect(() =>
      normalizeProviderOrigin('https://host.example/', 'https://host.example'),
    ).toThrow('separate origin')
  })

  it('requires an explicit provider instead of silently embedding an unsafe origin', () => {
    expect(() =>
      renderToStaticMarkup(createElement(Contact, { contact_id: 'ct_k92x' })),
    ).toThrow('ContactProvider')
  })

  it.each([
    [
      createElement(Avatar, { contact_id: 'ct_k92x', size: 'small' }),
      'Private avatar',
      40,
      40,
    ],
    [
      createElement(Avatar, { contact_id: 'ct_k92x', size: 'medium' }),
      'Private avatar',
      56,
      56,
    ],
    [
      createElement(Avatar, { contact_id: 'ct_k92x', size: 'large' }),
      'Private avatar',
      88,
      88,
    ],
    [
      createElement(Contact, { contact_id: 'ct_k92x' }),
      'Private contact',
      320,
      88,
    ],
    [
      createElement(Contact, { contact_id: 'ct_k92x', density: 'compact' }),
      'Private contact',
      320,
      68,
    ],
    [
      createElement(ContactList, { list_id: 'ls_j7mv' }),
      'Private contact list',
      360,
      360,
    ],
    [
      createElement(ContactList, { list_id: 'ls_j7mv', density: 'compact' }),
      'Private contact list',
      360,
      360,
    ],
  ] as const)(
    'server-renders %s without resolving private data',
    (component, title, width, height) => {
      const markup = renderToStaticMarkup(
        createElement(ContactProvider, {
          origin: providerOrigin,
          children: component,
        }),
      )

      expect({
        title: markup.match(/title="([^"]+)"/)?.[1],
        width: Number(markup.match(/width="(\d+)"/)?.[1]),
        height: Number(markup.match(/height="(\d+)"/)?.[1]),
        sandbox: markup.match(/sandbox="([^"]+)"/)?.[1],
        referrerPolicy: markup.match(/referrerPolicy="([^"]+)"/)?.[1],
        hasSourceBeforeParentOriginIsKnown: /src=/.test(markup),
      }).toEqual({
        title,
        width,
        height,
        sandbox: 'allow-scripts allow-same-origin',
        referrerPolicy: 'no-referrer',
        hasSourceBeforeParentOriginIsKnown: false,
      })
    },
  )
})

describe('explicit opaque sandbox isolation', () => {
  const hostOrigin = 'https://pgherveou.github.io'
  const embedPath = '/iframe-playground/provider/index.html'
  const configuration = {
    component: 'contact' as const,
    handle: 'ct_k92x',
    avatar: true,
    username: true,
    density: 'comfortable' as const,
    theme: 'light' as const,
    size: 'medium' as const,
  }

  it('allows a same-origin URL only when sandbox isolation is explicitly selected', () => {
    expect(normalizeProviderOrigin(hostOrigin, hostOrigin, 'sandbox')).toBe(
      hostOrigin,
    )
    expect(() => normalizeProviderOrigin(hostOrigin, hostOrigin)).toThrow(
      'separate origin',
    )
  })

  it('removes allow-same-origin so the renderer receives an opaque origin', () => {
    const markup = renderToStaticMarkup(
      createElement(ContactProvider, {
        origin: hostOrigin,
        isolation: 'sandbox',
        embedPath,
        children: createElement(Contact, { contact_id: 'ct_k92x' }),
      }),
    )
    expect(markup.match(/sandbox="([^"]+)"/)?.[1]).toBe('allow-scripts')
  })

  it('resolves a Pages project renderer path without changing the origin or public props', () => {
    const url = new URL(
      createEmbedUrl(hostOrigin, hostOrigin, channel, configuration, embedPath),
    )
    expect({
      origin: url.origin,
      path: url.pathname,
      handle: url.searchParams.get('handle'),
      parent: url.searchParams.get('parent_origin'),
    }).toEqual({
      origin: hostOrigin,
      path: embedPath,
      handle: 'ct_k92x',
      parent: hostOrigin,
    })
  })

  it.each([
    '//attacker.example/embed',
    'https://attacker.example/embed',
    'relative/embed',
    '/\\attacker.example/embed',
    '/%5cattacker.example/embed',
    '/%2fattacker.example/embed',
    '/provider/index.html?redirect=https://attacker.example',
    '/provider/index.html#fragment',
    '/\n/attacker.example/embed',
  ])(
    'rejects an embed path that is not an unambiguous local pathname: %s',
    (path) => {
      expect(() =>
        createEmbedUrl(hostOrigin, hostOrigin, channel, configuration, path),
      ).toThrow('pathname')
    },
  )

  it('rejects invalid embed paths during server rendering before any frame can navigate', () => {
    expect(() =>
      renderToStaticMarkup(
        createElement(ContactProvider, {
          origin: hostOrigin,
          isolation: 'sandbox',
          embedPath: '//attacker.example/embed',
          children: createElement(ContactList, { list_id: 'ls_4dn9' }),
        }),
      ),
    ).toThrow('pathname')
  })

  it('accepts null-origin selections only from the expected frame and channel', () => {
    const expected = { ...expectedFrame, origin: 'null' }
    expect([
      getSelectedHandle(selectionEvent({ origin: 'null' }), expected),
      getSelectedHandle(
        selectionEvent({ origin: 'null', source: {} as Window }),
        expected,
      ),
      getSelectedHandle(
        selectionEvent({
          origin: 'null',
          data: { ...selection, channel: 'other' },
        }),
        expected,
      ),
      getSelectedHandle(selectionEvent({ origin: hostOrigin }), expected),
      getSelectedHandle(
        selectionEvent({
          origin: 'null',
          data: { ...selection, username: 'Private name' },
        }),
        expected,
      ),
    ]).toEqual(['ct_k92x', null, null, null, null])
  })

  it('uses the opaque-origin target only for sandbox commands and correlates their real results', () => {
    const postMessage = vi.fn()
    const source = { postMessage } as unknown as Window
    const onAction = vi.fn()
    const onMessage = vi.fn()
    const messenger = createListMessenger(
      { origin: 'null', source, channel },
      { onAction, onMessage },
    )
    messenger.send('focus-search')
    const command = postMessage.mock.calls[0][0]
    const event = {
      origin: 'null',
      source,
      data: { ...command, type: 'action-result' },
    }
    messenger.receive({ ...event, source: {} as Window })
    messenger.receive({ ...event, origin: hostOrigin })
    messenger.receive({ ...event, data: { ...event.data, channel: 'other' } })
    const beforeValid = onAction.mock.calls.length
    messenger.receive(event)
    messenger.receive(event)
    expect({
      target: postMessage.mock.calls[0][1],
      beforeValid,
      actions: onAction.mock.calls,
      logs: onMessage.mock.calls,
    }).toEqual({
      target: '*',
      beforeValid: 0,
      actions: [['focus-search']],
      logs: [
        [{ direction: 'host-to-iframe', message: command }],
        [{ direction: 'iframe-to-host', message: event.data }],
      ],
    })
  })
})
