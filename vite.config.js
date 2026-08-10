import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const injectModelCatalog = () => ({
  name: 'inject-model-catalog',
  transform(code, id) {
    if (!id.endsWith('/src-code-env.jsx')) return null
    const modelBlock = /const models = \[[\s\S]*?\n\];/
    const replacement = `const models = [
  ['gpt-5.6-sol', 'GPT-5.6 Sol · 61 · Extra Limited Usage'],
  ['k3', 'Kimi K3 · 60 · Limited Usage'],
  ['qwen3.8-max', 'Qwen 3.8 Max · 58'],
  ['gpt-5.6-terra', 'GPT-5.6 Terra · 57'],
  ['claude-opus-4-8', 'Claude Opus 4.8 · 57'],
  ['claude-sonnet-5', 'Claude Sonnet 5 · 55 · Limited Usage'],
  ['glm-5.2', 'GLM 5.2 · 53 · Limited Usage'],
  ['gpt-5.6-luna', 'GPT-5.6 Luna · 52'],
  ['gemini-flash-latest', 'Gemini Flash · 52'],
  ['minimax-m3', 'Minimax M3 · 45'],
  ['gemini-flash-lite-latest', 'Gemini Flash Lite · 37']
];`
    if (!modelBlock.test(code)) return null
    return { code: code.replace(modelBlock, replacement), map: null }
  }
})

export default defineConfig({
  plugins: [react(), injectModelCatalog()]
})