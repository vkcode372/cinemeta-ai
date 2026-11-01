import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { registerGetBookingDetailsTool } from './get-booking-details.js';
import { registerGetMovieDetailsTool } from './get-movie-details.js';
import { registerGetMyBookingsTool } from './get-my-bookings.js';
import { registerGetPaymentStatusTool } from './get-payment-status.js';
import { registerSearchMoviesTool } from './search-movies.js';

export function registerTools(server: McpServer, backend: BackendApiClient): void {
  registerSearchMoviesTool(server, backend);
  registerGetMovieDetailsTool(server, backend);
  registerGetMyBookingsTool(server, backend);
  registerGetBookingDetailsTool(server, backend);
  registerGetPaymentStatusTool(server, backend);
}
