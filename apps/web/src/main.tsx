import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import App from './App';
import './styles/index.css';
import { registerPwa } from './lib/pwa';

declare global {
  interface Window {
    __polevkaReady?: () => void;
  }
}

function showBootFail() {
  document.getElementById('boot-fail')?.classList.add('is-on');
}

window.addEventListener('unhandledrejection', (ev) => {
  const msg = String((ev.reason && (ev.reason as Error).message) || ev.reason || '');
  if (/Failed to fetch dynamically imported module|Importing a module script failed|Loading chunk|error loading dynamically imported/i.test(msg)) {
    showBootFail();
  }
});

registerPwa();
try {
  createRoot(document.getElementById('root')!).render(<App />);
  window.__polevkaReady?.();
} catch {
  showBootFail();
}
