import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(__dirname, '..')

export default defineConfig(({ mode }) => {
  // Load env from both root project directory and client directory
  const envRoot = loadEnv(mode, rootDir, '')
  const envClient = loadEnv(mode, __dirname, '')
  const env = { ...envRoot, ...envClient, ...process.env }

  const apiUrl =
    env.VITE_API_BASE_URL ||
    env.VITE_API_URL ||
    env.VITE_BACKEND_URL ||
    ''

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_API_BASE_URL': JSON.stringify(apiUrl),
      'process.env.VITE_API_BASE_URL': JSON.stringify(apiUrl)
    },
    server: {
      port: 5173,
      proxy: {
        '/api': 'http://127.0.0.1:4000'
      }
    }
  }
})
