import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/resource/',
  server: {
    host: '0.0.0.0',  // 监听所有网卡，支持远程访问
    port: 5173,
  },
})
