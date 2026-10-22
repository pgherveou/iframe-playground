import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { parseConfig } from '../../apps/provider/src/config.js'
import { EmbedContent } from '../../apps/provider/src/embed-content.js'

const parentOrigin = 'https://pgherveou.github.io'

function query(values: Record<string, string> = {}) {
  return new URLSearchParams({
    component: 'contact',
    handle: 'ct_7hk2',
    channel: ':r0:',
    parent_origin: parentOrigin,
    ...values,
  })
}

describe('static provider', () => {
  it('uses the same public configuration contract under a project URL', () => {
    const url = new URL(
      `${parentOrigin}/iframe-playground/provider/index.html?${query()}`,
    )
    expect(parseConfig(url.searchParams, url.origin)).toEqual({
      component: 'contact',
      handle: 'ct_7hk2',
      channel: ':r0:',
      parentOrigin,
      avatar: true,
      username: true,
      density: 'comfortable',
      theme: 'light',
      size: 'medium',
    })
  })

  it.each<Record<string, string>>([
    { parent_origin: 'https://untrusted.example' },
    { parent_origin: `${parentOrigin}/iframe-playground` },
    { component: 'directory' },
    { avatar: 'yes' },
    { channel: '<script>' },
    { unexpected: 'property' },
  ])('rejects invalid static configuration %j', (values) => {
    expect(parseConfig(query(values), parentOrigin)).toBeUndefined()
  })

  it('rejects ambiguous duplicate configuration', () => {
    const params = query()
    params.append('component', 'list')
    expect(parseConfig(params, parentOrigin)).toBeUndefined()
  })

  it.each(['avatar', 'contact', 'list'])(
    'renders %s with project-relative avatar assets',
    (component) => {
      const config = parseConfig(
        query({
          component,
          handle: component === 'list' ? 'ls_6ty2' : 'ct_7hk2',
        }),
        parentOrigin,
      )!
      const markup = renderToStaticMarkup(
        createElement(EmbedContent, { config, avatarBase: './avatars' }),
      )
      expect({
        hasRelativeAvatar: markup.includes('src="./avatars/ct_7hk2.svg"'),
        hasRootAvatar: markup.includes('src="/avatars/'),
        includesName: markup.includes('Maya Chen'),
        hasSearch: markup.includes('aria-label="Search contacts"'),
      }).toEqual({
        hasRelativeAvatar: true,
        hasRootAvatar: false,
        includesName: component !== 'avatar',
        hasSearch: component === 'list',
      })
    },
  )

  it('preserves unavailable handle rendering in static mode', () => {
    const config = parseConfig(query({ handle: 'ct_unknown' }), parentOrigin)!
    const markup = renderToStaticMarkup(
      createElement(EmbedContent, { config, avatarBase: './avatars' }),
    )
    expect(markup).toContain('Contact unavailable')
  })
})
