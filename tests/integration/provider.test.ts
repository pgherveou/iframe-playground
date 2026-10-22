import type { Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createProviderServer } from '../../apps/provider/src/server.js'

const parentOrigin = 'http://localhost:5183'
let server: Server
let providerOrigin: string

function embedQuery(values: Record<string, string> = {}) {
  return new URLSearchParams({
    component: 'contact',
    handle: 'ct_7hk2',
    parent_origin: parentOrigin,
    channel: 'test_channel',
    ...values,
  })
}

async function embed(values: Record<string, string> = {}) {
  return fetch(`${providerOrigin}/embed?${embedQuery(values)}`)
}

beforeAll(async () => {
  server = createProviderServer({ parentOrigin })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  providerOrigin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(async () => {
  if (server)
    await new Promise<void>((resolve) => server.close(() => resolve()))
})

describe('trusted provider', () => {
  it('serves private records inside iframe HTML without enabling cross-origin reads', async () => {
    const response = await embed()
    const html = await response.text()

    expect({
      status: response.status,
      cors: response.headers.get('access-control-allow-origin'),
      cache: response.headers.get('cache-control'),
      nosniff: response.headers.get('x-content-type-options'),
      csp: response.headers.get('content-security-policy'),
      hasName: html.includes('Maya Chen'),
      hasUsername: html.includes('@mayac'),
      hasAvatar: html.includes('/avatars/ct_7hk2.svg'),
      hasOtherContact: html.includes('Alex Morgan'),
      hasInlineScript: /<script(?![^>]*src=)/.test(html),
      hasInlineStyle: /style=|<style/.test(html),
    }).toEqual({
      status: 200,
      cors: null,
      cache: 'no-store',
      nosniff: 'nosniff',
      csp: "default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors http://localhost:5183; form-action 'none'; base-uri 'none'",
      hasName: true,
      hasUsername: true,
      hasAvatar: true,
      hasOtherContact: false,
      hasInlineScript: false,
      hasInlineStyle: false,
    })
  })

  it('only includes fields requested for the contact component', async () => {
    const response = await embed({ avatar: 'false', username: 'false' })
    const html = await response.text()

    expect({
      status: response.status,
      hasName: html.includes('Maya Chen'),
      hasUsername: html.includes('@mayac'),
      hasAvatar: html.includes('<img'),
      hasPlaceholder: html.includes('Private contact'),
    }).toEqual({
      status: 200,
      hasName: false,
      hasUsername: false,
      hasAvatar: false,
      hasPlaceholder: true,
    })
  })

  it('resolves collection handles without leaking the rest of the directory', async () => {
    const response = await embed({ component: 'list', handle: 'ls_6ty2' })
    const html = await response.text()

    expect({
      status: response.status,
      rows: (html.match(/data-contact-row/g) ?? []).length,
      hasInternalSearch: html.includes('aria-label="Search contacts"'),
      hasFirst: html.includes('Maya Chen'),
      hasThird: html.includes('Noah Williams'),
      hasFourth: html.includes('Sofia Rivera'),
      channel: html.includes('data-channel="test_channel"'),
      parent: html.includes('data-parent-origin="http://localhost:5183"'),
    }).toEqual({
      status: 200,
      rows: 3,
      hasInternalSearch: true,
      hasFirst: true,
      hasThird: true,
      hasFourth: false,
      channel: true,
      parent: true,
    })
  })

  it('preserves React 18 channel identifiers for selection messages', async () => {
    const response = await embed({
      component: 'list',
      handle: 'ls_6ty2',
      channel: ':r0:',
    })
    const html = await response.text()
    expect({
      status: response.status,
      hasChannel: html.includes('data-channel=":r0:"'),
    }).toEqual({ status: 200, hasChannel: true })
  })

  it.each<Record<string, string>>([
    { parent_origin: 'https://untrusted.example' },
    { parent_origin: 'http://localhost:5183.evil.example' },
    { parent_origin: 'http://localhost:5183/extra' },
    { component: 'directory' },
    { theme: 'invalid' },
    { density: 'invalid' },
    { size: 'invalid' },
    { avatar: 'yes' },
    { username: 'yes' },
    { channel: '<script>' },
    { handle: '' },
  ])('rejects unsupported configuration %j', async (query) => {
    const response = await embed(query)
    expect({ status: response.status, body: await response.text() }).toEqual({
      status: 400,
      body: 'Invalid component request',
    })
  })

  it('rejects ambiguous duplicate parameters', async () => {
    const response = await fetch(
      `${providerOrigin}/embed?${embedQuery()}&theme=light&theme=dark`,
    )
    expect(response.status).toBe(400)
  })

  it.each([
    ['contact', 'ct_unknown', 'Contact unavailable'],
    ['avatar', 'ct_unknown', 'Contact unavailable'],
    ['list', 'ls_unknown', 'List unavailable'],
  ])(
    'renders a generic fallback for unavailable %s handles',
    async (component, handle, message) => {
      const response = await embed({ component, handle })
      const html = await response.text()
      expect({
        status: response.status,
        hasMessage: html.includes(message),
        hasName: html.includes('Maya Chen'),
      }).toEqual({ status: 200, hasMessage: true, hasName: false })
    },
  )

  it.each([
    '/src/server.tsx',
    '/src/contacts.ts',
    '/@fs/apps/provider/src/contacts.ts',
    '/api/contacts',
    '/package.json',
    '/avatars/ct_unknown.svg',
  ])(
    'does not expose private source or a directory API at %s',
    async (path) => {
      const response = await fetch(`${providerOrigin}${path}`)
      expect({ status: response.status, body: await response.text() }).toEqual({
        status: 404,
        body: 'Not found',
      })
    },
  )

  it.each(['/avatars/ct_7hk2.svg', '/component.css', '/component.js'])(
    'restricts provider subresources to its own origin at %s',
    async (path) => {
      const response = await fetch(`${providerOrigin}${path}`)
      expect({
        status: response.status,
        resourcePolicy: response.headers.get('cross-origin-resource-policy'),
      }).toEqual({ status: 200, resourcePolicy: 'same-origin' })
    },
  )

  it('serves local images without contact names in their SVG content', async () => {
    const response = await fetch(`${providerOrigin}/avatars/ct_7hk2.svg`)
    const image = await response.text()
    expect({
      status: response.status,
      contentType: response.headers.get('content-type'),
      isSvg: image.startsWith('<svg'),
      containsName: image.includes('Maya'),
    }).toEqual({
      status: 200,
      contentType: 'image/svg+xml',
      isSvg: true,
      containsName: false,
    })
  })

  it.each([
    'https://host.example/path',
    'javascript:alert(1)',
    'https://user:password@host.example',
    'null',
  ])('rejects a malformed trusted parent origin %s at startup', (origin) => {
    expect(() => createProviderServer({ parentOrigin: origin })).toThrow(
      'HOST_ORIGIN must be an HTTP(S) origin',
    )
  })
})
