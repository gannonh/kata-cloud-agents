import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import type { AgentTool, ToolResult } from '../types.js';

export class ToolRegistry {
  private tools = new Map<string, AgentTool>();
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
    addFormats(this.ajv);
  }

  register(tool: AgentTool): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" already registered`);
    }
    this.tools.set(tool.name, tool);
  }

  list(): Array<{ name: string; description: string; parameters: unknown }> {
    return Array.from(this.tools.values()).map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    }));
  }

  async execute(
    name: string,
    params: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: `Tool "${name}" not registered`,
        metadata: { requestedTool: name },
        isError: true,
      };
    }

    const validate = this.ajv.compile(tool.parameters);
    if (!validate(params)) {
      const errors =
        validate.errors?.map((e) => `${e.instancePath} ${e.message}`).join('; ') ?? 'unknown';
      return { content: `Parameter validation failed: ${errors}`, metadata: {}, isError: true };
    }

    try {
      return await tool.execute(params, signal);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { content: `Tool execution error: ${message}`, metadata: {}, isError: true };
    }
  }
}
