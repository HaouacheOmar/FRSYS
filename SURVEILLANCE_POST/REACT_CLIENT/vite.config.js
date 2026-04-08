import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  console.log(`Starting ${env.VITE_APP_NAME || 'React App'}...`)
  
<<<<<<< Updated upstream
  const targetIP = env.VITE_BACKEND_IP || '192.168.1.105'
  return {
    plugins: [react()],
    server: {
      host: true,
=======
  // const targetIP = env.VITE_BACKEND_IP || '192.168.1.105' || 'localhost' || '127.0.0.1'
  const targetIP = '192.168.1.105'
  return {
    plugins: [react()],
    server: {
      host: '192.168.1.105',
    
>>>>>>> Stashed changes
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