import { app } from './app.js';
import { env } from './config/env.js';

app.listen(env.PORT, env.HOST, () => {
  console.info(`CineMate MCP server listening on http://${env.HOST}:${env.PORT}/mcp`);
});
