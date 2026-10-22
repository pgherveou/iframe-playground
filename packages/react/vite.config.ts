import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL('./src/index.tsx', import.meta.url)),
      formats: ['es'],
      fileName: 'index',
    },
    rollupOptions: { external: ['react', 'react/jsx-runtime'] },
  },
})
