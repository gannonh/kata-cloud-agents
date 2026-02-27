import React from 'react';
import ReactDOM from 'react-dom/client';
import { Agentation } from 'agentation';

import './index.css';
import { App } from './App';
import { initRealtime } from './realtime';

const agentationEndpoint =
  import.meta.env.VITE_AGENTATION_ENDPOINT ?? 'http://127.0.0.1:4747';

try {
  initRealtime();
} catch (error) {
  console.warn('[Realtime] bootstrap failed; continuing without realtime', error);
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
    {import.meta.env.DEV && <Agentation endpoint={agentationEndpoint} />}
  </React.StrictMode>,
);
