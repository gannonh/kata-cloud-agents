export type HubConnection = {
  id: string;
  send: (payload: string) => void;
  close: (code: number, reason: string) => void;
  ping: () => void;
};

type HubLogger = {
  error: (meta: Record<string, unknown>, message: string) => void;
};

type HubState = {
  connection: HubConnection;
  subscriptions: Set<string>;
  lastPongAt: number;
};

export type RealtimeHub = ReturnType<typeof createRealtimeHub>;

export function createRealtimeHub(now: () => number = () => Date.now(), logger?: HubLogger) {
  const byId = new Map<string, HubState>();
  const channelMembers = new Map<string, Set<string>>();

  function addConnection(connection: HubConnection) {
    byId.set(connection.id, {
      connection,
      subscriptions: new Set(),
      lastPongAt: now(),
    });
  }

  function removeConnection(connectionId: string) {
    const state = byId.get(connectionId);
    if (!state) {
      return;
    }
    for (const channel of state.subscriptions) {
      const members = channelMembers.get(channel);
      if (!members) continue;
      members.delete(connectionId);
      if (members.size === 0) {
        channelMembers.delete(channel);
      }
    }
    byId.delete(connectionId);
  }

  function subscribe(connectionId: string, channel: string): boolean {
    const state = byId.get(connectionId);
    if (!state) return false;
    state.subscriptions.add(channel);
    const members = channelMembers.get(channel) ?? new Set<string>();
    members.add(connectionId);
    channelMembers.set(channel, members);
    return true;
  }

  function unsubscribe(connectionId: string, channel: string): boolean {
    const state = byId.get(connectionId);
    if (!state || !state.subscriptions.has(channel)) return false;
    state.subscriptions.delete(channel);
    const members = channelMembers.get(channel);
    if (!members) return true;
    members.delete(connectionId);
    if (members.size === 0) {
      channelMembers.delete(channel);
    }
    return true;
  }

  function publish(channel: string, payload: string): number {
    const members = channelMembers.get(channel);
    if (!members || members.size === 0) return 0;
    let sent = 0;
    // Iterate over a copied set so we can safely remove broken connections during fanout.
    for (const connectionId of [...members]) {
      const state = byId.get(connectionId);
      if (!state) continue;
      try {
        state.connection.send(payload);
        sent += 1;
      } catch (err) {
        logger?.error({ err, connectionId, channel }, 'failed to fanout realtime message');
        removeConnection(connectionId);
      }
    }
    return sent;
  }

  function markPong(connectionId: string) {
    const state = byId.get(connectionId);
    if (!state) return;
    state.lastPongAt = now();
  }

  function listStates() {
    return [...byId.values()].map((state) => ({
      connection: state.connection,
      subscriptions: new Set(state.subscriptions),
      lastPongAt: state.lastPongAt,
    }));
  }

  function subscriptionCount(connectionId: string): number {
    return byId.get(connectionId)?.subscriptions.size ?? 0;
  }

  return {
    addConnection,
    removeConnection,
    subscribe,
    unsubscribe,
    publish,
    markPong,
    listStates,
    subscriptionCount,
  };
}
