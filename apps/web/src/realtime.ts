import { createRealtimeBootstrap } from '@kata/realtime-client';

export const initRealtime = createRealtimeBootstrap({
  url: import.meta.env.VITE_GATEWAY_WS_URL ?? 'ws://localhost:3001/ws',
  autoConnect: import.meta.env.VITE_ENABLE_REALTIME === 'true',
});
