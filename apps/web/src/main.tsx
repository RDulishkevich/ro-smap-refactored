import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/index.css';
import { registerPwa } from './lib/pwa';

registerPwa();
createRoot(document.getElementById('root')!).render(<App />);
