import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { ToolDiscoveryResult } from '../types/index.js';
import { McpConnectionError } from '../errors.js';

export async function discoverTools(client: Client): Promise<ToolDiscoveryResult> {
  try {
    const result = await client.listTools();
    return { tools: result.tools, ...(result.nextCursor ? { nextCursor: result.nextCursor } : {}) };
  } catch (error) {
    throw new McpConnectionError('Failed to discover MCP tools', undefined, { cause: error });
  }
}
