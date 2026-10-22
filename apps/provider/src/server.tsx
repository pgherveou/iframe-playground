import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { avatarSvg, findContact } from './contacts.js'
import { renderEmbed, type EmbedConfig } from './render.js'

const supportedParams = new Set([
  'component',
  'handle',
  'avatar',
  'username',
  'density',
  'theme',
  'size',
  'parent_origin',
  'channel',
])

function parseConfig(
  params: URLSearchParams,
  parentOrigin: string,
): EmbedConfig | undefined {
  for (const key of params.keys()) {
    if (!supportedParams.has(key) || params.getAll(key).length !== 1) return
  }
  const component = params.get('component')
  const handle = params.get('handle') ?? ''
  const channel = params.get('channel') ?? ''
  const avatar = params.get('avatar') ?? 'true'
  const username = params.get('username') ?? 'true'
  const density = params.get('density') ?? 'comfortable'
  const theme = params.get('theme') ?? 'light'
  const size = params.get('size') ?? 'medium'
  if (
    params.get('parent_origin') !== parentOrigin ||
    !/^[a-zA-Z0-9_-]{1,128}$/.test(handle) ||
    !/^[a-zA-Z0-9_:-]{1,128}$/.test(channel)
  )
    return
  if (component !== 'avatar' && component !== 'contact' && component !== 'list')
    return
  if (avatar !== 'true' && avatar !== 'false') return
  if (username !== 'true' && username !== 'false') return
  if (density !== 'comfortable' && density !== 'compact') return
  if (theme !== 'light' && theme !== 'dark') return
  if (size !== 'small' && size !== 'medium' && size !== 'large') return
  return {
    component,
    handle,
    avatar: avatar === 'true',
    username: username === 'true',
    density,
    theme,
    size,
    parentOrigin,
    channel,
  }
}

function validateParentOrigin(parentOrigin: string) {
  try {
    const url = new URL(parentOrigin)
    if (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.origin === parentOrigin
    )
      return
  } catch {}
  throw new Error('HOST_ORIGIN must be an HTTP(S) origin')
}

export function createProviderServer({
  parentOrigin = process.env.HOST_ORIGIN ?? 'http://localhost:5183',
} = {}) {
  validateParentOrigin(parentOrigin)
  const styles = readFileSync(
    new URL('../public/component.css', import.meta.url),
  )
  const script = readFileSync(
    new URL('../public/component.js', import.meta.url),
  )
  const csp = `default-src 'none'; script-src 'self'; style-src 'self'; img-src 'self'; frame-ancestors ${parentOrigin}; form-action 'none'; base-uri 'none'`

  return createServer((request, response) => {
    response.setHeader('Content-Security-Policy', csp)
    response.setHeader('Cross-Origin-Resource-Policy', 'same-origin')
    response.setHeader('Cache-Control', 'no-store')
    response.setHeader('X-Content-Type-Options', 'nosniff')
    response.setHeader('Referrer-Policy', 'no-referrer')
    const send = (
      status: number,
      body: string | Buffer,
      contentType = 'text/plain; charset=utf-8',
    ) => {
      response.writeHead(status, { 'Content-Type': contentType })
      response.end(body)
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      response.setHeader('Allow', 'GET, HEAD')
      return send(405, 'Method not allowed')
    }
    const url = new URL(request.url ?? '/', 'http://provider.local')
    if (url.pathname === '/embed') {
      const config = parseConfig(url.searchParams, parentOrigin)
      return config
        ? send(200, renderEmbed(config), 'text/html; charset=utf-8')
        : send(400, 'Invalid component request')
    }
    if (url.pathname === '/component.css')
      return send(200, styles, 'text/css; charset=utf-8')
    if (url.pathname === '/component.js')
      return send(200, script, 'text/javascript; charset=utf-8')
    const avatarMatch = /^\/avatars\/([a-zA-Z0-9_-]{1,128})\.svg$/.exec(
      url.pathname,
    )
    if (avatarMatch) {
      const contact = findContact(avatarMatch[1])
      if (contact) return send(200, avatarSvg(contact), 'image/svg+xml')
    }
    return send(404, 'Not found')
  })
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const port = Number(process.env.PROVIDER_PORT ?? 5184)
  createProviderServer().listen(port, 'localhost', () => {
    console.log(`Contact provider listening on http://localhost:${port}`)
  })
}
