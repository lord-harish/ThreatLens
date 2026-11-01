import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiProxyTarget = env.VITE_API_PROXY_TARGET || 'http://127.0.0.1:8001';

  return {
    plugins: [react()],
    resolve: {
      preserveSymlinks: true
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks: {
            vendor: ['react', 'react-dom', 'react-router-dom'],
            charts: ['recharts']
          }
        }
      }
    },
    server: {
      port: 3000,
      open: false,
      proxy: {
        '/api': apiProxyTarget
      }
    }
  };
});
