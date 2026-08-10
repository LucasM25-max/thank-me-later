import { mountTranslateTool } from './translate-tool.jsx';

function startTranslate() {
  try {
    mountTranslateTool();
  } catch (error) {
    console.error('[Translate] Failed to mount Translate tool:', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startTranslate, { once: true });
} else {
  startTranslate();
}
