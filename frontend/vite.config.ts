import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { existsSync, readFileSync } from 'fs'

const hasCerts = existsSync('./certs/key.pem') && existsSync('./certs/cert.pem')

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    ...(hasCerts
      ? {
          https: {
            key: readFileSync('./certs/key.pem'),
            cert: readFileSync('./certs/cert.pem'),
          },
        }
      : {}),
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
