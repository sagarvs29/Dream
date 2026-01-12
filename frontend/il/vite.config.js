import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const port = Number(env.VITE_PORT || 5174)
  return {
    plugins: [
      tailwindcss(),
    ],
    server: {
      host: true, // listen on all network interfaces for LAN/mobile testing
      port,
    },
  }
})