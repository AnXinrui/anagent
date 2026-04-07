import type { ToolDefinition } from './types.js';

const tools: Map<string, ToolDefinition> = new Map();

export function registerTool(tool: ToolDefinition): void {
  tools.set(tool.name, tool);
}

export function getAllTools(): ToolDefinition[] {
  return [...tools.values()];
}

export function getTool(name: string): ToolDefinition | undefined {
  return tools.get(name);
}