import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const server = process.env.MAWQI_SERVER || 'http://localhost:4000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: {
      '/api': server,
      '/socket.io': { target: server, ws: true },
    },
  },
})
