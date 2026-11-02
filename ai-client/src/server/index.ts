import 'dotenv/config';
import { z } from 'zod';
import { createChatApp } from './chat-app.js';

const envSchema = z.object({
  AI_CLIENT_PORT: z.coerce.number().int().positive().default(4200),
  AI_CLIENT_HOST: z.string().default('127.0.0.1'),
  AI_CLIENT_SERVICE_TOKEN: z.string().min(32),
  JWT_SECRET: z.string().min(32),
  MCP_SERVER_URL: z.string().url(),
  AI_AGENT_MAX_ITERATIONS: z.coerce.number().int().min(1).max(12).default(5),
});
const env = envSchema.parse(process.env);
const app = createChatApp({
  jwtSecret: env.JWT_SECRET,
  serviceToken: env.AI_CLIENT_SERVICE_TOKEN,
  mcpServerUrl: env.MCP_SERVER_URL,
  maxIterations: env.AI_AGENT_MAX_ITERATIONS,
});
export { McpClient } from '../client/mcp-client.js';
export { openMcpConnection } from '../client/connection.js';
export { discoverTools } from '../client/tool-discovery.js';
export { executeTool } from '../client/tool-executor.js';
export { McpConnectionError, McpToolExecutionError } from '../errors.js';
export type {
  McpClientOptions,
  McpClientState,
  McpToolArguments,
  McpToolDefinition,
  McpToolResult,
  ToolDiscoveryResult,
} from '../types/index.js';

export { OllamaProvider, OllamaProviderError } from '../llm/ollama.provider.js';
export { OllamaConfigurationError, loadOllamaConfig } from '../llm/ollama.config.js';
export { runFunctionCallingTurn, FunctionCallingWorkflowError } from '../llm/function-calling.js';
export { adaptMcpTools, InvalidToolArgumentsError, ToolAdapterError } from '../mcp/tool-adapter.js';
export { AgentRuntime, AgentRuntimeError } from '../agent/agent-runtime.js';
export type { AgentRuntimeOptions, AgentToolFailure, AgentTurnResult } from '../agent/agent-runtime.js';
export type { LlmFunctionCall, LlmInterface, LlmRequestOptions, LlmResponse } from '../llm/llm.interface.js';
export type { FunctionCallFailure, FunctionCallingTurnResult } from '../llm/function-calling.js';

app.listen(env.AI_CLIENT_PORT, env.AI_CLIENT_HOST, () => {
  console.log(`AI client chat service listening at http://${env.AI_CLIENT_HOST}:${env.AI_CLIENT_PORT}`);
});
