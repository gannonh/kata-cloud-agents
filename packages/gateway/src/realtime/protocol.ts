import { z } from 'zod';

export const OutboundTypeSchema = z.enum([
  'agent_status_changed',
  'log_entry',
  'spec_updated',
  'task_completed',
  'blocker_raised',
  'subscribed',
  'unsubscribed',
  'error',
  'pong',
]);

export const OutboundMessageSchema = z.object({
  type: OutboundTypeSchema,
  channel: z.string().min(1).optional(),
  timestamp: z.string().datetime(),
  eventId: z.string().min(1),
  encoding: z.literal('json'),
  payload: z.unknown(),
});

export const InboundCommandSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    channel: z.string().min(1),
  }),
  z.object({
    type: z.literal('unsubscribe'),
    channel: z.string().min(1),
  }),
  z.object({
    type: z.literal('ping'),
  }),
]);

export type OutboundType = z.infer<typeof OutboundTypeSchema>;
export type OutboundMessage = z.infer<typeof OutboundMessageSchema>;
export type InboundCommand = z.infer<typeof InboundCommandSchema>;
