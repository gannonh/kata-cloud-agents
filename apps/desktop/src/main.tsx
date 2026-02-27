import React from 'react';
import ReactDOM from 'react-dom/client';
import { Agentation } from 'agentation';

import { App } from './App';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';
import { initRealtime } from './realtime';

const agentationEndpoint =
  import.meta.env.VITE_AGENTATION_ENDPOINT ?? 'http://127.0.0.1:4747';

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

try {
  initRealtime();
} catch (error) {
  console.warn('[Realtime] bootstrap failed; continuing without realtime', error);
}

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
    {import.meta.env.DEV && <Agentation endpoint={agentationEndpoint} />}
  </React.StrictMode>,
);
