import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/main',
      rollupOptions: {
        input: resolve('app/main/main.ts')
      }
    }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    build: {
      outDir: 'out/preload',
      rollupOptions: {
        input: resolve('app/main/preload.ts')
      }
    }
  },
  renderer: {
    root: 'app/renderer',
    build: {
      outDir: 'out/renderer',
      rollupOptions: {
        input: resolve('app/renderer/index.html')
      }
    },
    plugins: [react()]
  }
})
