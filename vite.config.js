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
  ['gemini-flash-latest', 'Gemini 3.6 Flash · 52'],
  ['minimax-m3', 'Minimax M3 · 45'],
  ['gemini-flash-lite-latest', 'Gemini 3.5 Flash-Lite · 37']
];`
    if (!modelBlock.test(code)) return null
    let transformed = code.replace(modelBlock, replacement)
    const handleFilesBlock = /const handleFiles=e=>\{[\s\S]*?e\.target\.value='';\};/
    const fixedHandleFiles = `const handleFiles=e=>{const incoming=[...e.target.files].slice(0,6);Promise.all(incoming.map(file=>new Promise(resolve=>{const reader=new FileReader();reader.onload=()=>{const bytes=new Uint8Array(reader.result||new ArrayBuffer(0));let binary='';const chunkSize=0x8000;for(let i=0;i<bytes.length;i+=chunkSize)binary+=String.fromCharCode(...bytes.subarray(i,Math.min(i+chunkSize,bytes.length)));const data=btoa(binary);let text='';if(file.type.startsWith('text/')||/\\.(md|json|js|ts|jsx|tsx|css|html|py|txt|xml)$/i.test(file.name)){try{text=new TextDecoder().decode(bytes)}catch{}}resolve({name:file.name,type:file.type||'application/octet-stream',data,text})};reader.onerror=()=>resolve({name:file.name,type:file.type||'application/octet-stream',data:'',text:''});reader.readAsArrayBuffer(file)}))).then(next=>setFiles(next));e.target.value='';};`
    transformed = transformed.replace(handleFilesBlock, fixedHandleFiles)
    transformed = transformed.replace("import './command-menu.css';", "import './command-menu.css';\nimport { mountTranslateTool } from './translate-tool.jsx';")
    transformed = transformed.replace('function App(){', 'function App(){\n  useEffect(() => { mountTranslateTool(); }, []);')
    return { code: transformed, map: null }
  }
})

export default defineConfig({
  plugins: [react(), injectModelCatalog()]
})