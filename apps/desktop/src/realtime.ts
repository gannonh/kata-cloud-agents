import { createRealtimeClient } from '@kata/realtime-client';

let client: ReturnType<typeof createRealtimeClient> | null = null;

export function initRealtime() {
  if (client) {
    return client;
  }

  client = createRealtimeClient({
    url: import.meta.env.VITE_GATEWAY_WS_URL ?? 'ws://localhost:3001/ws',
  });

  if (import.meta.env.VITE_ENABLE_REALTIME === 'true') {
    client.connect();
  }

  return client;
}
