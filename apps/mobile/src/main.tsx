import React from 'react';
import ReactDOM from 'react-dom/client';

import { App } from './App';
import { initRealtime } from './realtime';

try {
  initRealtime();
} catch (error) {
  console.warn('[Realtime] bootstrap failed; continuing without realtime', error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
