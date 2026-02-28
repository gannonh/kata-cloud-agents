// Canonical table name list. Replace with defineSchema/defineTable calls
// when the first Convex function is implemented and a project is provisioned.
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
