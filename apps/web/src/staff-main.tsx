import { createRoot } from 'react-dom/client';
import '@fontsource-variable/geist';
import './styles/index.css';
import { StaffApp } from './StaffApp';

createRoot(document.getElementById('root')!).render(<StaffApp />);
