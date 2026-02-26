import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initRealtime } from './realtime';

window.addEventListener('unhandledrejection', (event) => {
  console.error('[Unhandled Promise Rejection]', event.reason);
});

window.addEventListener('error', (event) => {
  console.error('[Uncaught Error]', event.error);
});

const rootEl = document.getElementById('root');
if (!rootEl) {
  document.body.innerHTML =
    '<div style="padding:2rem;font-family:system-ui;color:#ef4444">' +
    '<h1>Application failed to start</h1>' +
    '<p>Could not find the root element. Please restart the application.</p>' +
    '</div>';
  throw new Error('Root element #root not found');
}

initRealtime();

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
