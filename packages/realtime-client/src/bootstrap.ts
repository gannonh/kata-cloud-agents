import { createRealtimeClient } from './client.js';

export type RealtimeBootstrapConfig = {
  url: string;
  autoConnect: boolean;
};

export function createRealtimeBootstrap(config: RealtimeBootstrapConfig) {
  let client: ReturnType<typeof createRealtimeClient> | null = null;

  return function initRealtime() {
    if (client) {
      return client;
    }

    client = createRealtimeClient({
      url: config.url,
    });

    if (config.autoConnect) {
      client.connect();
    }

    return client;
  };
}
