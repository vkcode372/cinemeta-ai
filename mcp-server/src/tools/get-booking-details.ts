import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { toolResult } from './result.js';

const inputSchema = z.object({ booking_id: z.string().uuid() }).strict();

export function registerGetBookingDetailsTool(server: McpServer, backend: BackendApiClient): void {
  server.registerTool('get_booking_details', {
    title: 'Get booking details',
    description: 'Get a booking by UUID only when it belongs to the authenticated user.',
    inputSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ booking_id }) => toolResult(() => backend.get(`/api/bookings/${encodeURIComponent(booking_id)}`)));
}
