import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const injectMinimaxModel = () => ({
  name: 'inject-minimax-m3-model',
  transform(code, id) {
    if (!id.endsWith('/src-code-env.jsx')) return null
    const marker = "  ['gemini-flash-lite-latest', 'Gemini Flash Lite']\n"
    const replacement = `${marker}  ['minimax-m3', 'Minimax M3']\n`
    if (!code.includes(marker) || code.includes("['minimax-m3', 'Minimax M3']")) return null
    return { code: code.replace(marker, replacement), map: null }
  }
})

export default defineConfig({
  plugins: [react(), injectMinimaxModel()]
})