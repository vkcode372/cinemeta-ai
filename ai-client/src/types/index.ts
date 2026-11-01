import type { CallToolResult, Tool } from '@modelcontextprotocol/sdk/types.js';

export interface McpClientOptions {
  serverUrl: string;
  accessToken: string;
  clientName?: string;
  clientVersion?: string;
}

export type McpClientState = 'disconnected' | 'connecting' | 'connected';
export type McpToolDefinition = Tool;
export type McpToolArguments = Record<string, unknown>;
export type McpToolResult = CallToolResult;

export interface ToolDiscoveryResult {
  tools: McpToolDefinition[];
  nextCursor?: string;
}
