import { flushSync } from 'react-dom'
import { createRoot } from 'react-dom/client'
import { parseConfig } from './config.js'
import { EmbedContent } from './embed-content.js'

const url = new URL(window.location.href)
const config = parseConfig(url.searchParams, url.origin)
const root = createRoot(document.getElementById('root')!)

if (!config) {
  root.render(<p role="status">Invalid component request</p>)
} else {
  document.documentElement.dataset.theme = config.theme
  document.body.className = `component-${config.component} density-${config.density} size-${config.size}`
  document.body.dataset.channel = config.channel
  document.body.dataset.parentOrigin = config.parentOrigin
  flushSync(() => {
    root.render(<EmbedContent config={config} avatarBase="./avatars" />)
  })
  if (config.component === 'list') {
    const script = document.createElement('script')
    script.src = './component.js'
    document.body.append(script)
  }
}
