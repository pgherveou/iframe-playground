import { renderToStaticMarkup } from 'react-dom/server'
import type { EmbedConfig } from './config.js'
import { EmbedContent } from './embed-content.js'

export function renderEmbed(config: EmbedConfig) {
  return (
    '<!doctype html>' +
    renderToStaticMarkup(
      <html lang="en" data-theme={config.theme}>
        <head>
          <meta charSet="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          <title>Private contact component</title>
          <link rel="stylesheet" href="/component.css" />
        </head>
        <body
          className={`component-${config.component} density-${config.density} size-${config.size}`}
          data-channel={config.channel}
          data-parent-origin={config.parentOrigin}
        >
          <EmbedContent config={config} />
          {config.component === 'list' && <script src="/component.js" />}
        </body>
      </html>,
    )
  )
}
