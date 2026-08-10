import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const injectModelCatalog = () => ({
  name: 'inject-model-catalog',
  transform(code, id) {
    if (!id.endsWith('/src-code-env.jsx')) return null
    const modelBlock = /const models = \[[\s\S]*?\n\];/
    const replacement = `const models = [
  ['minimax-m3', 'Minimax M3 · 45'],
  ['gpt-5.6-terra', 'GPT-5.6 Terra · 57'],
  ['claude-sonnet-5', 'Claude Sonnet 5 · 55'],
  ['glm-5.2', 'GLM 5.2 · 53'],
  ['gpt-5.6-luna', 'GPT-5.6 Luna · 52'],
  ['gemini-flash-latest', 'Gemini Flash · 52'],
  ['gemini-flash-lite-latest', 'Gemini Flash Lite · 37']
];`
    if (!modelBlock.test(code)) return null
    return { code: code.replace(modelBlock, replacement), map: null }
  }
})

export default defineConfig({
  plugins: [react(), injectModelCatalog()]
})