import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// In development the PHP server runs with `npm run dev` in ../server (port 8000).
const server = process.env.MAWQI_SERVER || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    proxy: { '/api': server },
  },
})
