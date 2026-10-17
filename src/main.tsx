import { createRoot } from 'react-dom/client';
import { App } from './App';

createRoot(document.getElementById('root')!).render(<App />);

if ('serviceWorker' in navigator) {
  const register = () => navigator.serviceWorker.register('/sw.js').catch(() => {});
  if (document.readyState === 'complete') register();
  else window.addEventListener('load', register, { once: true });
}
