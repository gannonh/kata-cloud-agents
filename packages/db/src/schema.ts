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
    // $onUpdateFn is a Drizzle ORM hook, not a database trigger.
    // Only updates via Drizzle's .update() auto-set this timestamp.
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().$onUpdateFn(() => sql`now()`).notNull(),
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
    // References an external sandbox/environment service; no FK constraint.
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
    // Denormalized uuid array for read performance; integrity enforced at the application layer.
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

export const usersRelations = relations(users, ({ many }) => ({
  teamMemberships: many(teamMembers),
  createdSpecs: many(specs),
  createdApiKeys: many(apiKeys),
}));

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
  specs: many(specs),
  auditEvents: many(auditLog),
  apiKeys: many(apiKeys),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  user: one(users, {
    fields: [teamMembers.userId],
    references: [users.id],
  }),
  team: one(teams, {
    fields: [teamMembers.teamId],
    references: [teams.id],
  }),
}));

export const specsRelations = relations(specs, ({ one, many }) => ({
  team: one(teams, {
    fields: [specs.teamId],
    references: [teams.id],
  }),
  creator: one(users, {
    fields: [specs.createdBy],
    references: [users.id],
  }),
  versions: many(specVersions),
  agentRuns: many(agentRuns),
  tasks: many(tasks),
}));

export const specVersionsRelations = relations(specVersions, ({ one }) => ({
  spec: one(specs, {
    fields: [specVersions.specId],
    references: [specs.id],
  }),
}));

export const agentRunsRelations = relations(agentRuns, ({ one, many }) => ({
  spec: one(specs, {
    fields: [agentRuns.specId],
    references: [specs.id],
  }),
  tasks: many(tasks),
  artifacts: many(artifacts),
  auditEvents: many(auditLog),
}));

export const tasksRelations = relations(tasks, ({ one }) => ({
  spec: one(specs, {
    fields: [tasks.specId],
    references: [specs.id],
  }),
  agentRun: one(agentRuns, {
    fields: [tasks.agentRunId],
    references: [agentRuns.id],
  }),
}));

export const artifactsRelations = relations(artifacts, ({ one }) => ({
  agentRun: one(agentRuns, {
    fields: [artifacts.agentRunId],
    references: [agentRuns.id],
  }),
}));

export const auditLogRelations = relations(auditLog, ({ one }) => ({
  team: one(teams, {
    fields: [auditLog.teamId],
    references: [teams.id],
  }),
  agentRun: one(agentRuns, {
    fields: [auditLog.agentRunId],
    references: [agentRuns.id],
  }),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  team: one(teams, {
    fields: [apiKeys.teamId],
    references: [teams.id],
  }),
  creator: one(users, {
    fields: [apiKeys.createdBy],
    references: [users.id],
  }),
}));
