import { describe, expect, it } from 'vitest';
import { InboundCommandSchema, OutboundMessageSchema } from '../realtime/protocol.js';

describe('realtime protocol', () => {
  it('accepts required outbound event types', () => {
    const base = {
      timestamp: '2026-02-26T00:00:00.000Z',
      eventId: 'evt_1',
      encoding: 'json',
      payload: {},
    } as const;

    expect(OutboundMessageSchema.parse({ ...base, type: 'agent_status_changed' }).type).toBe(
      'agent_status_changed',
    );
    expect(OutboundMessageSchema.parse({ ...base, type: 'log_entry' }).type).toBe('log_entry');
    expect(OutboundMessageSchema.parse({ ...base, type: 'spec_updated' }).type).toBe('spec_updated');
    expect(OutboundMessageSchema.parse({ ...base, type: 'task_completed' }).type).toBe('task_completed');
    expect(OutboundMessageSchema.parse({ ...base, type: 'blocker_raised' }).type).toBe('blocker_raised');
  });

  it('accepts subscribe command', () => {
    const cmd = InboundCommandSchema.parse({ type: 'subscribe', channel: 'team:t1' });
    expect(cmd.type).toBe('subscribe');
  });

  it('accepts unsubscribe and ping commands', () => {
    const unsubscribe = InboundCommandSchema.parse({ type: 'unsubscribe', channel: 'team:t1' });
    expect(unsubscribe.type).toBe('unsubscribe');
    const ping = InboundCommandSchema.parse({ type: 'ping' });
    expect(ping.type).toBe('ping');
  });

  it('rejects malformed inbound commands', () => {
    expect(InboundCommandSchema.safeParse({ type: 'subscribe' }).success).toBe(false);
    expect(InboundCommandSchema.safeParse({ type: 'unknown', channel: 'team:t1' }).success).toBe(false);
  });
});
