import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin({ exclude: [] })],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    },
    build: {
      rollupOptions: {
        external: ['better-sqlite3', 'uuid']
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: {
      alias: {
        '@shared': resolve('src/shared')
      }
    }
  },
  renderer: {
    resolve: {
      alias: {
        '@shared': resolve('src/shared'),
        '@renderer': resolve('src/renderer')
      }
    },
    plugins: [react()],
    build: {
      rollupOptions: {
        input: {
          overlay: resolve(__dirname, 'src/renderer/index.html'),
          manager: resolve(__dirname, 'src/renderer/manager.html'),
          details: resolve(__dirname, 'src/renderer/details.html'),
          screenshot: resolve(__dirname, 'src/renderer/screenshot.html'),
          toolkit: resolve(__dirname, 'src/renderer/toolkit.html')
        }
      }
    }
  }
})
