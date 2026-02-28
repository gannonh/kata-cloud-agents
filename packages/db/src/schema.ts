/**
 * Convex table name contract used by @kata/db exports.
 *
 * The canonical table list also appears in convex/schema.ts for the
 * Convex runtime. A sync test in schema-contract.test.ts asserts
 * both copies stay identical.
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
