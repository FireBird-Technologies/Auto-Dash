import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// Disable console.log and console.warn
console.log = () => {};
console.warn = () => {};
// Keep console.error for actual errors

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <App />
  );
}


