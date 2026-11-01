import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpClientOptions } from '../types/index.js';
import { McpConnectionError } from '../errors.js';

export interface McpConnection {
  client: Client;
  transport: StreamableHTTPClientTransport;
}

export async function openMcpConnection(options: McpClientOptions): Promise<McpConnection> {
  if (!options.accessToken.trim()) throw new McpConnectionError('An MCP access token is required');

  let serverUrl: URL;
  try {
    serverUrl = new URL(options.serverUrl);
    if (serverUrl.protocol !== 'http:' && serverUrl.protocol !== 'https:') throw new Error('Unsupported protocol');
  } catch (error) {
    throw new McpConnectionError('MCP server URL must be a valid HTTP or HTTPS URL', undefined, { cause: error });
  }

  const client = new Client({
    name: options.clientName ?? 'cinemate-ai-client',
    version: options.clientVersion ?? '0.1.0',
  }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(serverUrl, {
    requestInit: { headers: { Authorization: `Bearer ${options.accessToken}` } },
  });

  try {
    await client.connect(transport);
    return { client, transport };
  } catch (error) {
    await client.close().catch(() => undefined);
    const statusCode = typeof error === 'object' && error !== null && 'code' in error && typeof error.code === 'number'
      ? error.code
      : undefined;
    throw new McpConnectionError('Could not connect to the authenticated MCP server', statusCode, { cause: error });
  }
}
