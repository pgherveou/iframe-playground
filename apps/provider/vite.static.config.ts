import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import { avatarSvg, findList } from './src/contacts.js'

const localPath = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig({
  root: localPath('.'),
  publicDir: false,
  define: { 'process.env.NODE_ENV': JSON.stringify('production') },
  plugins: [
    {
      name: 'static-provider-assets',
      generateBundle() {
        for (const [fileName, sourcePath] of [
          ['index.html', './static/index.html'],
          ['component.css', './public/component.css'],
          ['component.js', './public/component.js'],
        ]) {
          this.emitFile({
            type: 'asset',
            fileName,
            source: readFileSync(localPath(sourcePath)),
          })
        }
        for (const contact of findList('ls_4dn9')!) {
          this.emitFile({
            type: 'asset',
            fileName: `avatars/${contact.handle}.svg`,
            source: avatarSvg(contact),
          })
        }
      },
    },
  ],
  build: {
    outDir: localPath('../host/dist/provider'),
    emptyOutDir: true,
    lib: {
      entry: localPath('./src/static.tsx'),
      name: 'OpaqueContactEmbed',
      formats: ['iife'],
      fileName: () => 'embed.js',
    },
  },
})
