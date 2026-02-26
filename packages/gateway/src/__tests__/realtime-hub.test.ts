import { describe, expect, it, vi } from 'vitest';
import { createRealtimeHub } from '../realtime/hub.js';

describe('realtime hub', () => {
  it('publishes to subscribed connections only', () => {
    const hub = createRealtimeHub(() => 1_000);
    const sendA = vi.fn();
    const sendB = vi.fn();
    const sendC = vi.fn();

    hub.addConnection({ id: 'a', send: sendA, close: vi.fn(), ping: vi.fn() });
    hub.addConnection({ id: 'b', send: sendB, close: vi.fn(), ping: vi.fn() });
    hub.addConnection({ id: 'c', send: sendC, close: vi.fn(), ping: vi.fn() });

    hub.subscribe('a', 'team:t1');
    hub.subscribe('b', 'team:t1');
    hub.subscribe('c', 'team:t2');

    const delivered = hub.publish('team:t1', '{"type":"spec_updated"}');
    expect(delivered).toBe(2);
    expect(sendA).toHaveBeenCalledTimes(1);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(sendC).not.toHaveBeenCalled();
  });

  it('removes subscriptions on disconnect', () => {
    const hub = createRealtimeHub(() => 1_000);
    const send = vi.fn();

    hub.addConnection({ id: 'a', send, close: vi.fn(), ping: vi.fn() });
    hub.subscribe('a', 'team:t1');
    hub.removeConnection('a');
    const delivered = hub.publish('team:t1', '{"type":"spec_updated"}');
    expect(delivered).toBe(0);
  });

  it('continues fanout when one send throws', () => {
    const logger = { error: vi.fn() };
    const hub = createRealtimeHub(() => 1_000, logger);
    const sendA = vi.fn(() => {
      throw new Error('socket closed');
    });
    const sendB = vi.fn();

    hub.addConnection({ id: 'a', send: sendA, close: vi.fn(), ping: vi.fn() });
    hub.addConnection({ id: 'b', send: sendB, close: vi.fn(), ping: vi.fn() });
    hub.subscribe('a', 'team:t1');
    hub.subscribe('b', 'team:t1');

    const delivered = hub.publish('team:t1', '{"type":"spec_updated"}');
    expect(delivered).toBe(1);
    expect(sendB).toHaveBeenCalledTimes(1);
    expect(logger.error).toHaveBeenCalledTimes(1);
  });

  it('reports subscription count in O(1) lookup path', () => {
    const hub = createRealtimeHub(() => 1_000);
    hub.addConnection({ id: 'a', send: vi.fn(), close: vi.fn(), ping: vi.fn() });
    hub.subscribe('a', 'team:t1');
    hub.subscribe('a', 'spec:s1');

    expect(hub.subscriptionCount('a')).toBe(2);
    expect(hub.subscriptionCount('missing')).toBe(0);
  });
});
