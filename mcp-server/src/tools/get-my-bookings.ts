import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { toolResult } from './result.js';

const inputSchema = z
  .object({
    status: z.enum(['pending', 'confirmed', 'cancelled', 'active']).optional(),
  })
  .strict();

export function registerGetMyBookingsTool(server: McpServer, backend: BackendApiClient): void {
  server.registerTool(
    'get_my_bookings',
    {
      title: 'Get my bookings',
      description:
        'List the authenticated user’s bookings, including movie, cinema, showtime, and seats. Use status confirmed for active bookings. Never invent booking IDs; get them from this tool before checking a payment.',
      inputSchema,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    async ({ status }) =>
      toolResult(() => {
        const query = new URLSearchParams({ limit: '100' });
        if (status) query.set('status', status === 'active' ? 'confirmed' : status);
        return backend.get(`/api/bookings/?${query.toString()}`);
      }),
  );
}
