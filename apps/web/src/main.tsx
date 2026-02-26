import React from 'react';
import ReactDOM from 'react-dom/client';

import './index.css';
import { App } from './App';
import { initRealtime } from './realtime';

initRealtime();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
