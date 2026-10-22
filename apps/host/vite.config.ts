import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const localPath = (relative: string) =>
  fileURLToPath(new URL(relative, import.meta.url))

export default defineConfig(({ command, mode }) => ({
  root: localPath('.'),
  base: mode === 'pages' ? '/iframe-playground/' : '/',
  plugins: [react()],
  resolve: {
    alias:
      command === 'serve'
        ? [
            {
              find: '@opaque-ui/react',
              replacement: localPath('../../packages/react/src/index.tsx'),
            },
          ]
        : [],
  },
  server: {
    host: 'localhost',
    port: 5183,
    strictPort: true,
    cors: false,
    fs: {
      strict: true,
      allow: [
        localPath('.'),
        localPath('../../packages/react'),
        localPath('../../node_modules'),
      ],
      deny: [
        '**/apps/provider/**',
        '.env',
        '.env.*',
        '**/.git/**',
        '**/.agent/**',
      ],
    },
  },
  preview: { host: 'localhost', port: 5183, strictPort: true, cors: false },
  build: { outDir: 'dist', emptyOutDir: true },
}))
