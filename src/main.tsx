import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';
import { useStore } from './state/store';

if (import.meta.env.DEV) (window as any).__store = useStore;

createRoot(document.getElementById('root')!).render(<App />);
