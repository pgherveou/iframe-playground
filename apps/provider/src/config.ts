export interface EmbedConfig {
  component: 'avatar' | 'contact' | 'list'
  handle: string
  avatar: boolean
  username: boolean
  density: 'comfortable' | 'compact'
  theme: 'light' | 'dark'
  size: 'small' | 'medium' | 'large'
  parentOrigin: string
  channel: string
}

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

export function parseConfig(
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
