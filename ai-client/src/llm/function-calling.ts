import type { Content, FunctionCall, FunctionResponse, Part } from '@google/genai';
import type { McpClient } from '../client/mcp-client.js';
import type { McpToolResult } from '../types/index.js';
import { adaptMcpTools, InvalidToolArgumentsError } from '../mcp/tool-adapter.js';
import type { LlmInterface } from './llm.interface.js';

export interface FunctionCallFailure {
  name: string;
  message: string;
}

export interface FunctionCallingTurnResult {
  text: string;
  toolCalls: Array<{ name: string; result: McpToolResult }>;
  toolErrors: FunctionCallFailure[];
}

export class FunctionCallingWorkflowError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FunctionCallingWorkflowError';
  }
}

function functionCallParts(calls: FunctionCall[]): Part[] {
  return calls.flatMap((call) => call.name ? [{ functionCall: call }] : []);
}

function resultObject(result: McpToolResult): Record<string, unknown> {
  if (!Array.isArray(result.content) || result.content.length === 0) {
    throw new FunctionCallingWorkflowError('MCP tool returned an invalid empty result');
  }
  const text = result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.type === 'text' ? block.text : '')
    .filter(Boolean)
    .join('\n');
  if (!text && result.structuredContent !== undefined) return { output: result.structuredContent };
  if (!text) throw new FunctionCallingWorkflowError('MCP tool returned no content the model can use');
  try {
    return { output: JSON.parse(text) as unknown };
  } catch {
    return { output: text };
  }
}

function toolFailureMessage(error: unknown): string {
  if (error instanceof InvalidToolArgumentsError) return `Invalid function arguments: ${error.message}`;
  if (error instanceof Error) return error.message;
  return 'Tool execution failed';
}

/** Runs a single tool-call round; persistent conversation/agent loops are deferred. */
export async function runFunctionCallingTurn(
  provider: LlmInterface,
  mcpClient: McpClient,
  userMessage: string,
): Promise<FunctionCallingTurnResult> {
  const discovered = await mcpClient.listTools();
  const adapted = adaptMcpTools(discovered.tools);
  const userContent: Content = { role: 'user', parts: [{ text: userMessage }] };
  const firstResponse = await provider.generateResponse([userContent], {
    functionDeclarations: adapted.declarations,
  });

  const calls = firstResponse.functionCalls;
  if (!calls.length) return { text: firstResponse.text ?? '', toolCalls: [], toolErrors: [] };

  const modelContent: Content = firstResponse.candidateContent ?? {
    role: 'model',
    parts: functionCallParts(calls),
  };
  const functionResponses: Part[] = [];
  const toolCalls: FunctionCallingTurnResult['toolCalls'] = [];
  const toolErrors: FunctionCallFailure[] = [];

  for (const call of calls) {
    const name = call.name;
    if (!name) throw new FunctionCallingWorkflowError('The model returned a function call without a name');

    let response: Record<string, unknown>;
    const tool = adapted.byName.get(name);
    if (!tool) {
      const message = `Unknown tool request rejected: ${name}`;
      response = { error: { message } };
      toolErrors.push({ name, message });
      return { text: 'The requested tool is unavailable, so no unrecognized function was executed.', toolCalls, toolErrors };
    } else {
      try {
        const args = tool.validateArguments(call.args ?? {});
        const result = await mcpClient.callTool(name, args);
        toolCalls.push({ name, result });
        response = resultObject(result);
      } catch (error) {
        const message = toolFailureMessage(error);
        response = { error: { message } };
        toolErrors.push({ name, message });
      }
    }

    const functionResponse: FunctionResponse = { name, response, ...(call.id ? { id: call.id } : {}) };
    functionResponses.push({ functionResponse });
  }

  const finalResponse = await provider.generateResponse([
    userContent,
    modelContent,
    { role: 'user', parts: functionResponses },
  ], {
    functionDeclarations: adapted.declarations,
    disableFunctionCalling: true,
  });

  if (finalResponse.functionCalls.length) {
    throw new FunctionCallingWorkflowError('The model requested another tool round; start a new turn for the next request');
  }
  return { text: finalResponse.text ?? '', toolCalls, toolErrors };
}
