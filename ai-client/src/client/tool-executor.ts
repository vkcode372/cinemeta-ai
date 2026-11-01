import type { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { McpToolArguments, McpToolResult } from '../types/index.js';
import { McpToolExecutionError } from '../errors.js';

function toolErrorMessage(result: McpToolResult): string {
  const messages = result.content
    .filter((item) => item.type === 'text')
    .map((item) => item.type === 'text' ? item.text : '')
    .filter(Boolean);
  return messages.join('\n') || 'MCP server reported a tool execution error';
}

export async function executeTool(
  client: Client,
  toolName: string,
  args: McpToolArguments = {},
): Promise<McpToolResult> {
  try {
    const result = await client.callTool({ name: toolName, arguments: args });
    if (!('content' in result) || !Array.isArray(result.content)) {
      throw new McpToolExecutionError(toolName, 'MCP server returned a task-based result, which this client does not support');
    }
    const toolResult = result as CallToolResult;
    if (toolResult.isError) throw new McpToolExecutionError(toolName, toolErrorMessage(toolResult));
    return toolResult;
  } catch (error) {
    if (error instanceof McpToolExecutionError) throw error;
    throw new McpToolExecutionError(toolName, 'MCP tool call failed', { cause: error });
  }
}
