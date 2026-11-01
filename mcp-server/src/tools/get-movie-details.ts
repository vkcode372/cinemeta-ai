import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { toolResult } from './result.js';

const inputSchema = z.object({ movie_id: z.string().uuid() }).strict();

export function registerGetMovieDetailsTool(server: McpServer, backend: BackendApiClient): void {
  server.registerTool('get_movie_details', {
    title: 'Get movie details',
    description: 'Get a movie and its show and cinema details by movie UUID.',
    inputSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async ({ movie_id }) => toolResult(() => backend.get(`/api/movies/${encodeURIComponent(movie_id)}`)));
}
