/**
 * Convex-oriented schema contract used by @kata/db exports.
 *
 * This intentionally avoids Drizzle/Postgres bindings while the data layer
 * migration moves the package onto Convex.
 */
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

export type ConvexDocument = Record<string, unknown>;

export type ConvexSchema = {
  [K in ConvexTableName]: ConvexDocument;
};
