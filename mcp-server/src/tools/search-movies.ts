import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { BackendApiClient } from '../services/backend-api.client.js';
import { ToolError } from '../errors/app-error.js';
import { toolResult } from './result.js';

const inputSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  genre: z.string().trim().min(1).max(80).optional(),
  language: z.string().trim().min(1).max(80).optional(),
}).strict();

export function registerSearchMoviesTool(server: McpServer, backend: BackendApiClient): void {
  server.registerTool('search_movies', {
    title: 'Search movies',
    description: 'Search the movie catalog by title, genre, and/or language.',
    inputSchema,
    annotations: { readOnlyHint: true, openWorldHint: true },
  }, async (input) => toolResult(() => {
    if (!input.title && !input.genre && !input.language) {
      throw new ToolError('Provide at least one of title, genre, or language');
    }
    const query = new URLSearchParams();
    if (input.title) query.set('title', input.title);
    if (input.genre) query.set('genre', input.genre);
    if (input.language) query.set('language', input.language);
    query.set('limit', '50');
    return backend.get(`/api/movies/?${query.toString()}`);
  }));
}
