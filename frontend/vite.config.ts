import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync } from 'fs'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    https: {
      key: readFileSync('./certs/key.pem'),
      cert: readFileSync('./certs/cert.pem'),
    },
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
})
