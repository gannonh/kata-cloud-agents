import { relations, sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

export const teamRoleEnum = pgEnum('team_role', ['admin', 'member', 'viewer']);
export const specStatusEnum = pgEnum('spec_status', ['draft', 'active', 'paused', 'completed', 'archived']);
export const agentRunStatusEnum = pgEnum('agent_run_status', ['queued', 'running', 'completed', 'failed', 'cancelled']);
export const taskStatusEnum = pgEnum('task_status', ['pending', 'assigned', 'running', 'completed', 'failed', 'skipped']);

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teams = pgTable('teams', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export const teamMembers = pgTable(
  'team_members',
  {
    userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    role: teamRoleEnum('role').notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.teamId] }),
    index('team_members_team_id_idx').on(table.teamId),
  ],
);

export const specs = pgTable(
  'specs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    title: text('title').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    status: specStatusEnum('status').notNull().default('draft'),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('specs_team_id_idx').on(table.teamId)],
);

export const specVersions = pgTable(
  'spec_versions',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    versionNumber: text('version_number').notNull(),
    content: jsonb('content').$type<Record<string, unknown>>().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    unique('spec_versions_spec_id_version_number_key').on(table.specId, table.versionNumber),
    index('spec_versions_spec_id_idx').on(table.specId),
  ],
);

export const agentRuns = pgTable(
  'agent_runs',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    agentRole: text('agent_role').notNull(),
    status: agentRunStatusEnum('status').notNull().default('queued'),
    environmentId: uuid('environment_id').notNull(),
    model: text('model').notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => [index('agent_runs_spec_id_idx').on(table.specId)],
);

export const tasks = pgTable(
  'tasks',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    specId: uuid('spec_id').notNull().references(() => specs.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    title: text('title').notNull(),
    status: taskStatusEnum('status').notNull().default('pending'),
    dependsOn: uuid('depends_on').array().notNull().default(sql`ARRAY[]::uuid[]`),
    result: jsonb('result').$type<Record<string, unknown>>(),
  },
  (table) => [
    index('tasks_spec_id_idx').on(table.specId),
    index('tasks_agent_run_id_idx').on(table.agentRunId),
  ],
);

export const artifacts = pgTable(
  'artifacts',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    agentRunId: uuid('agent_run_id').notNull().references(() => agentRuns.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    path: text('path').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (table) => [index('artifacts_agent_run_id_idx').on(table.agentRunId)],
);

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    agentRunId: uuid('agent_run_id').references(() => agentRuns.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    details: jsonb('details').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    timestamp: timestamp('timestamp', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('audit_log_team_id_idx').on(table.teamId)],
);

export const apiKeys = pgTable(
  'api_keys',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    keyHash: text('key_hash').notNull().unique(),
    prefix: text('prefix').notNull(),
    createdBy: uuid('created_by').notNull().references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
  },
  (table) => [
    index('api_keys_team_id_idx').on(table.teamId),
    index('api_keys_created_by_idx').on(table.createdBy),
  ],
);

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  specs: many(specs),
  auditEvents: many(auditLog),
  apiKeys: many(apiKeys),
}));
