import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  console.log(`Starting ${env.VITE_APP_NAME || 'React App'}...`)
  
  // const targetIP = env.VITE_BACKEND_IP || '192.168.1.105' || 'localhost' || '127.0.0.1'
  const targetIP = '127.0.0.1'
  return {
    plugins: [react()],
    server: {
      host: '127.0.0.1',
    
      port: 3000,
      proxy: {
        '/api': {
          target: `http://${targetIP}:8000`,

          changeOrigin: true,
        },
        '/ws': {
          target: `ws://${targetIP}:8000`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
}

)