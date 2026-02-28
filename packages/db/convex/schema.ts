export const convexTables = [
  'users',
  'teams',
  'teamMembers',
  'specs',
  'specVersions',
  'agentRuns',
  'tasks',
  'artifacts',
  'auditLog',
  'apiKeys',
] as const;

export type ConvexTableName = (typeof convexTables)[number];
