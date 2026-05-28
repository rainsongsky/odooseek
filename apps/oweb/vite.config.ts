import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [
    TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api/odoo': {
        target: 'http://localhost:8069',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/odoo/, ''),
      },
      '/web': {
        target: 'http://localhost:8069',
        changeOrigin: true,
      },
    },
  },
})
