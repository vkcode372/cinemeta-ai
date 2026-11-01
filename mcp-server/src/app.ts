import express, { type RequestHandler } from 'express';
import { randomUUID } from 'node:crypto';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';
import { AppError } from './errors/app-error.js';
import { authenticateMcpRequest } from './middlewares/authenticate.js';
import { errorHandler } from './middlewares/error-handler.js';
import { BackendApiClient } from './services/backend-api.client.js';
import { registerTools } from './tools/register-tools.js';

type McpSessionContext = { userId: string; token: string };
type Session = {
  transport: StreamableHTTPServerTransport;
  context: McpSessionContext;
  lastSeenAt: number;
};

const sessions = new Map<string, Session>();
const sessionTtlMs = 30 * 60 * 1000;

function createMcpServer(context: McpSessionContext): McpServer {
  const server = new McpServer({ name: 'cinemate-mcp-server', version: '0.1.0' });
  registerTools(server, new BackendApiClient(() => context.token));
  return server;
}

function sessionIdFromRequest(req: express.Request): string | undefined {
  const header = req.headers['mcp-session-id'];
  return typeof header === 'string' ? header : undefined;
}

const handleMcpRequest: RequestHandler = async (req, res, next) => {
  try {
    const principal = req.mcpPrincipal;
    if (!principal) throw new AppError(401, 'Authentication is required');

    const now = Date.now();
    for (const [id, session] of sessions) {
      if (now - session.lastSeenAt > sessionTtlMs) {
        sessions.delete(id);
        void session.transport.close();
      }
    }

    const sessionId = sessionIdFromRequest(req);
    if (sessionId) {
      const session = sessions.get(sessionId);
      if (!session) throw new AppError(404, 'MCP session not found or expired');
      if (session.context.userId !== principal.userId) throw new AppError(403, 'MCP session belongs to another user');
      session.context.token = principal.token;
      session.lastSeenAt = now;
      await session.transport.handleRequest(req, res, req.body);
      return;
    }

    if (req.method !== 'POST' || !isInitializeRequest(req.body)) {
      throw new AppError(400, 'A valid MCP initialize request is required');
    }

    const context: McpSessionContext = { userId: principal.userId, token: principal.token };
    const server = createMcpServer(context);
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: randomUUID,
      onsessioninitialized: (id) => {
        sessions.set(id, { transport, context, lastSeenAt: Date.now() });
      },
    });
    transport.onclose = () => {
      const id = transport.sessionId;
      if (id) sessions.delete(id);
    };
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    next(error);
  }
};

export const app = express();
app.use(express.json({ limit: '1mb' }));
app.get('/health', (_req, res) => res.json({ status: 'ok' }));
app.all('/mcp', authenticateMcpRequest, handleMcpRequest);
app.use((_req, res) => res.status(404).json({ error: { message: 'Route not found' } }));
app.use(errorHandler);

export { sessions };
