import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { toolResult } from './result.js';

export function registerGetMyProfileTool(server: McpServer, backend: BackendApiClient): void {
  server.registerTool(
    'get_my_profile',
    {
      title: 'Get my profile',
      description: 'Get the authenticated user’s profile name and email address.',
      inputSchema: {},
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async () => toolResult(() => backend.get('/api/auth/me')),
  );
}
