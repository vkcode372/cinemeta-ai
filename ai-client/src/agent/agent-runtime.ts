import type { Content, FunctionCall, FunctionResponse, Part } from '@google/genai';
import type { McpClient } from '../client/mcp-client.js';
import { adaptMcpTools, InvalidToolArgumentsError } from '../mcp/tool-adapter.js';
import type { McpToolResult } from '../types/index.js';
import type { LlmInterface } from '../llm/llm.interface.js';

export interface AgentRuntimeOptions {
  /** Maximum number of model/tool-call rounds in one user turn. */
  maxIterations?: number;
}

export interface AgentToolFailure {
  name: string;
  message: string;
}

export interface AgentTurnResult {
  text: string;
  toolCalls: Array<{ name: string; result: McpToolResult }>;
  toolErrors: AgentToolFailure[];
  iterations: number;
}

export class AgentRuntimeError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'AgentRuntimeError';
  }
}

const DEFAULT_MAX_ITERATIONS = 5;
const MAX_ALLOWED_ITERATIONS = 12;

function callParts(calls: FunctionCall[]): Part[] {
  return calls.flatMap((call) => call.name ? [{ functionCall: call }] : []);
}

function toolOutput(result: McpToolResult): Record<string, unknown> {
  if (!Array.isArray(result.content) || result.content.length === 0) {
    throw new AgentRuntimeError('MCP returned an empty or invalid tool result');
  }
  const text = result.content
    .filter((block) => block.type === 'text')
    .map((block) => block.type === 'text' ? block.text : '')
    .filter(Boolean)
    .join('\n');
  if (text) {
    try {
      return { output: JSON.parse(text) as unknown };
    } catch {
      return { output: text };
    }
  }
  if (result.structuredContent !== undefined) return { output: result.structuredContent };
  throw new AgentRuntimeError('MCP returned no usable tool content');
}

function errorMessage(error: unknown): string {
  if (error instanceof InvalidToolArgumentsError) return `Invalid arguments: ${error.message}`;
  if (error instanceof Error) return error.message;
  return 'Tool execution failed';
}

/**
 * Stateful runtime bound to one authenticated MCP client. Create a separate runtime/client
 * pair for each authenticated user; no identity is accepted from model-generated arguments.
 */
export class AgentRuntime {
  private readonly history: Content[] = [];
  private readonly maxIterations: number;

  constructor(
    private readonly provider: LlmInterface,
    private readonly mcpClient: McpClient,
    options: AgentRuntimeOptions = {},
  ) {
    this.maxIterations = options.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    if (!Number.isInteger(this.maxIterations) || this.maxIterations < 1 || this.maxIterations > MAX_ALLOWED_ITERATIONS) {
      throw new AgentRuntimeError(`maxIterations must be an integer between 1 and ${MAX_ALLOWED_ITERATIONS}`);
    }
  }

  getConversationHistory(): Content[] {
    return structuredClone(this.history);
  }

  clearConversation(): void {
    this.history.length = 0;
  }

  async sendMessage(message: string): Promise<AgentTurnResult> {
    const normalizedMessage = message.trim();
    console.log(`Sending message: ${normalizedMessage}`);
    if (!normalizedMessage) throw new AgentRuntimeError('Message must not be empty');

    const userContent: Content = { role: 'user', parts: [{ text: normalizedMessage }] };
    this.history.push(userContent);
    const toolCalls: AgentTurnResult['toolCalls'] = [];
    const toolErrors: AgentToolFailure[] = [];
    let iterations = 0;

    for (; iterations < this.maxIterations; iterations += 1) {
      console.log(`Iteration ${iterations + 1} of ${this.maxIterations}`);
      // Refresh the allow-list at each round, so execution is limited to tools advertised
      // by the currently authenticated MCP session.
      const discovered = await this.mcpClient.listTools();
      console.log(`Discovered ${discovered.tools.length} tools: ${discovered.tools.map((t) => t.name).join(', ')}`);
      const adapted = adaptMcpTools(discovered.tools);
      const response = await this.provider.generateResponse(this.history, {
        functionDeclarations: adapted.declarations,
      });
      console.log(`LLM returned ${JSON.stringify(response)} ${response.functionCalls.length} function calls`);

      if (!response.functionCalls.length) {
        if (response.candidateContent) this.history.push(response.candidateContent);
        else if (response.text) this.history.push({ role: 'model', parts: [{ text: response.text }] });
        return { text: response.text ?? '', toolCalls, toolErrors, iterations: iterations + 1 };
      }

      const modelContent = response.candidateContent ?? {
        role: 'model' as const,
        parts: callParts(response.functionCalls),
      };
      this.history.push(modelContent);
      const functionResponses: Part[] = [];

      // Sequential execution preserves call order and keeps each call on the same
      // authenticated MCP session. Only the discovered map can authorize a call.
      for (const call of response.functionCalls) {
        const name = call.name;
        if (!name) {
          throw new AgentRuntimeError('LLM returned a tool call without a name');
        }

        const tool = adapted.byName.get(name);
        let payload: Record<string, unknown>;
        if (!tool) {
          const message = `Unknown tool request rejected: ${name}`;
          payload = { error: { message } };
          toolErrors.push({ name, message });
        } else {
          try {
            const args = tool.validateArguments(call.args ?? {});
            const result = await this.mcpClient.callTool(name, args);
            payload = toolOutput(result);
            toolCalls.push({ name, result });
          } catch (error) {
            const message = errorMessage(error);
            payload = { error: { message } };
            toolErrors.push({ name, message });
          }
        }

        const functionResponse: FunctionResponse = {
          name,
          response: payload,
          ...(call.id ? { id: call.id } : {}),
        };
        functionResponses.push({ functionResponse });
      }

      if (functionResponses.length) {
        this.history.push({ role: 'user', parts: functionResponses });
      }
    }

    // Do not execute further tool requests after the configured limit. Ask the model to
    // summarize the results already collected with function calling disabled.
    const finalResponse = await this.provider.generateResponse(this.history, { disableFunctionCalling: true });
    if (finalResponse.functionCalls.length) {
      throw new AgentRuntimeError('LLM returned a function call after tool execution was disabled');
    }
    if (finalResponse.candidateContent) this.history.push(finalResponse.candidateContent);
    else if (finalResponse.text) this.history.push({ role: 'model', parts: [{ text: finalResponse.text }] });
    return { text: finalResponse.text ?? '', toolCalls, toolErrors, iterations };
  }
}
