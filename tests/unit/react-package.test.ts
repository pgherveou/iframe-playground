import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import {
  Avatar,
  Contact,
  ContactList,
  ContactProvider,
} from '../../packages/react/src/index'
import {
  createEmbedUrl,
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
