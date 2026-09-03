import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

console.log('[singbox-desktop] Webview UI initialized.');

window.addEventListener('error', (event) => {
  console.error('[singbox-desktop][Webview Error]', event.error || event.message, event);
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('[singbox-desktop][Webview Unhandled Rejection]', event.reason);
});

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
