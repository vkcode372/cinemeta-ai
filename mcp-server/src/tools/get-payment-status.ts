import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { toolResult } from './result.js';

const inputSchema = z.object({ booking_id: z.string().uuid() }).strict();

export function registerGetPaymentStatusTool(server: McpServer, backend: BackendApiClient): void {
  server.registerTool('get_payment_status', {
    title: 'Get payment status',
    description: 'Get the payment status for a booking owned by the authenticated user.',
    inputSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ booking_id }) => toolResult(() => backend.get(`/api/payments/bookings/${encodeURIComponent(booking_id)}/status`)));
}
