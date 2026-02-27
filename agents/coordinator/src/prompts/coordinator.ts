import type { Spec } from '@kata/shared';
import { serializeSpec } from '@kata/spec-engine';

export function buildCoordinatorPrompt(spec: Spec): {
  systemPrompt: string;
  userMessage: string;
} {
  const specYaml = serializeSpec(spec);

  const systemPrompt = `You are a Coordinator agent. Your job is to:

1. Read the spec provided by the user
2. Explore the codebase using file_read and shell_exec to understand the project structure
3. Decompose the spec into concrete, ordered tasks

Output a JSON array of tasks. Each task must have:
- "title": string - a clear, actionable title
- "description": string - what to do, which files to touch
- "dependsOn": number[] - indices of tasks this depends on (0-indexed)

Return ONLY the JSON array, no other text. Example:
[
  { "title": "Create database migration", "description": "Add new column...", "dependsOn": [] },
  { "title": "Update API endpoint", "description": "Modify the handler...", "dependsOn": [0] }
]`;

  const userMessage = `Here is the spec to decompose:\n\n${specYaml}`;

  return { systemPrompt, userMessage };
}
