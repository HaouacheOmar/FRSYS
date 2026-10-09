import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  console.log(`Starting ${env.VITE_APP_NAME || 'React App'}...`)
  
  const targetIP = env.VITE_BACKEND_IP || 'localhost'
  const targetPort = env.VITE_BACKEND_PORT || '8000'

  return {
    plugins: [react()],
    server: {
      host: true,
      port: 3000,
      proxy: {
        '/api': {
          target: `http://${targetIP}:${targetPort}`,

          changeOrigin: true,
        },
        '/ws': {
          target: `ws://${targetIP}:${targetPort}`,
          ws: true,
          changeOrigin: true,
        },
      },
    },
  }
}

)