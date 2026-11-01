import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { McpClientOptions, McpClientState, McpToolArguments, McpToolResult, ToolDiscoveryResult } from '../types/index.js';
import { McpConnectionError } from '../errors.js';
import { openMcpConnection, type McpConnection } from './connection.js';
import { discoverTools } from './tool-discovery.js';
import { executeTool } from './tool-executor.js';

export class McpClient {
  private connection?: McpConnection;
  private pendingConnection?: Promise<McpConnection>;
  private currentState: McpClientState = 'disconnected';

  constructor(private readonly options: McpClientOptions) {}

  get state(): McpClientState {
    return this.currentState;
  }

  async connect(): Promise<void> {
    if (this.connection) return;
    if (!this.pendingConnection) {
      this.currentState = 'connecting';
      this.pendingConnection = openMcpConnection(this.options);
    }
    try {
      this.connection = await this.pendingConnection;
      this.currentState = 'connected';
    } catch (error) {
      this.currentState = 'disconnected';
      throw error;
    } finally {
      this.pendingConnection = undefined;
    }
  }

  async listTools(): Promise<ToolDiscoveryResult> {
    return discoverTools(this.requireClient());
  }

  async callTool(toolName: string, args: McpToolArguments = {}): Promise<McpToolResult> {
    return executeTool(this.requireClient(), toolName, args);
  }

  async close(): Promise<void> {
    const connection = this.connection;
    this.connection = undefined;
    this.currentState = 'disconnected';
    if (connection) await connection.client.close();
  }

  private requireClient(): Client {
    if (!this.connection) throw new McpConnectionError('Connect to the MCP server before calling tools');
    return this.connection.client;
  }
}
