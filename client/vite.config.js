import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5173,
    // O navegador só fala com o Vite; o Vite repassa /api para a API.
    proxy: { '/api': 'http://localhost:3000' },
  },
})
