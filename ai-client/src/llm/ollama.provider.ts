import type { Content, FunctionDeclaration, Part } from '@google/genai';
import type { LlmInterface, LlmRequestOptions, LlmResponse } from './llm.interface.js';
import { loadOllamaConfig, type OllamaConfig } from './ollama.config.js';

interface OllamaToolCall {
  function: { name: string; arguments: Record<string, unknown> };
}
interface OllamaChatResponse {
  message?: { content?: string; tool_calls?: OllamaToolCall[] };
  error?: string;
}
type OllamaFetch = typeof fetch;

const CINEMATE_SYSTEM_PROMPT = [
  'You are CineMate, a movie and booking assistant.',
  'Use the provided tools for the user’s profile, bookings, movie catalog, showtimes, seats, and payment status.',
  'Never invent or guess booking IDs, movie IDs, payment details, tool results, or booking statuses.',
  'If a user asks about their bookings or payment and has not supplied a real booking ID, call get_my_bookings first. Use an ID returned by that tool if you need get_payment_status or get_booking_details.',
  'Use only the tool argument values allowed by the tool schema. The word active means status confirmed.',
  'When a tool call is needed, invoke the provided tool directly. Do not write a JSON example or pretend to call a tool in ordinary text.',
  'If no matching record is returned, say so clearly. Do not claim that a tool succeeded unless its result confirms it.',
].join(' ');

export class OllamaProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'OllamaProviderError';
  }
}

function toOllamaMessages(contents: Content[]): Array<Record<string, unknown>> {
  const messages: Array<Record<string, unknown>> = [];
  for (const content of contents) {
    const role = content.role === 'model' ? 'assistant' : content.role;
    const text =
      content.parts
        ?.flatMap((part) => (typeof part.text === 'string' ? [part.text] : []))
        .join('') ?? '';
    const calls =
      content.parts?.flatMap((part) =>
        part.functionCall
          ? [
              {
                function: { name: part.functionCall.name, arguments: part.functionCall.args ?? {} },
              },
            ]
          : [],
      ) ?? [];
    const responses =
      content.parts?.flatMap((part) =>
        part.functionResponse
          ? [
              {
                role: 'tool',
                name: part.functionResponse.name,
                content: JSON.stringify(part.functionResponse.response),
              },
            ]
          : [],
      ) ?? [];
    if (text || calls.length)
      messages.push({
        role,
        ...(text ? { content: text } : {}),
        ...(calls.length ? { tool_calls: calls } : {}),
      });
    messages.push(...responses);
  }
  return messages;
}

function ollamaTools(declarations: FunctionDeclaration[]): Array<Record<string, unknown>> {
  return declarations.map((declaration) => ({
    type: 'function',
    function: {
      name: declaration.name,
      ...(declaration.description ? { description: declaration.description } : {}),
      parameters: declaration.parametersJsonSchema ?? { type: 'object', properties: {} },
    },
  }));
}

function recoverAdvertisedToolCalls(
  text: string,
  declarations: FunctionDeclaration[],
): OllamaToolCall[] {
  if (!declarations.length || !text.includes('{')) return [];
  const allowedNames = new Set(declarations.map((declaration) => declaration.name));
  const calls: OllamaToolCall[] = [];
  for (let start = 0; start < text.length; start += 1) {
    if (text[start] !== '{') continue;
    let depth = 0;
    let quoted = false;
    let escaped = false;
    for (let end = start; end < text.length; end += 1) {
      const character = text[end];
      if (quoted) {
        if (escaped) escaped = false;
        else if (character === '\\') escaped = true;
        else if (character === '"') quoted = false;
        continue;
      }
      if (character === '"') quoted = true;
      else if (character === '{') depth += 1;
      else if (character === '}') {
        depth -= 1;
        if (depth === 0) {
          try {
            const candidate: unknown = JSON.parse(text.slice(start, end + 1));
            if (
              typeof candidate === 'object' &&
              candidate !== null &&
              'name' in candidate &&
              typeof candidate.name === 'string' &&
              allowedNames.has(candidate.name)
            ) {
              const record = candidate as {
                name: string;
                parameters?: unknown;
                arguments?: unknown;
                args?: unknown;
              };
              const args = record.parameters ?? record.arguments ?? record.args ?? {};
              if (typeof args === 'object' && args !== null && !Array.isArray(args)) {
                calls.push({
                  function: { name: record.name, arguments: args as Record<string, unknown> },
                });
              }
            }
          } catch {
            // Ignore prose braces and malformed JSON; only complete JSON tool objects are recoverable.
          }
          start = end;
          break;
        }
      }
    }
  }
  return calls;
}

export class OllamaProvider implements LlmInterface {
  constructor(
    private readonly config: OllamaConfig = loadOllamaConfig(),
    private readonly request: OllamaFetch = fetch,
  ) {}

  async generateResponse(
    contents: Content[],
    options: LlmRequestOptions = {},
  ): Promise<LlmResponse> {
    const declarations = options.disableFunctionCalling ? [] : (options.functionDeclarations ?? []);
    let response: Response;
    try {
      response = await this.request(`${this.config.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: this.config.model,
          stream: false,
          messages: [
            { role: 'system', content: CINEMATE_SYSTEM_PROMPT },
            ...toOllamaMessages(contents),
          ],
          ...(declarations.length ? { tools: ollamaTools(declarations) } : {}),
        }),
      });
    } catch (error) {
      throw new OllamaProviderError('Ollama server is unavailable', undefined, true, {
        cause: error,
      });
    }
    if (!response.ok) {
      const detail = await response.text().catch(() => '');
      const message = detail
        ? `Ollama request failed (${response.status}): ${detail.slice(0, 300)}`
        : `Ollama request failed (${response.status})`;
      throw new OllamaProviderError(message, response.status, response.status >= 500);
    }
    let data: OllamaChatResponse;
    try {
      data = (await response.json()) as OllamaChatResponse;
    } catch (error) {
      throw new OllamaProviderError('Ollama returned an invalid response', response.status, false, {
        cause: error,
      });
    }
    const calls = data.message?.tool_calls?.length
      ? data.message.tool_calls
      : recoverAdvertisedToolCalls(data.message?.content ?? '', declarations);
    const functionCalls = calls.map(({ function: fn }) => ({ name: fn.name, args: fn.arguments }));
    const parts: Part[] = [
      ...(data.message?.content ? [{ text: data.message.content }] : []),
      ...functionCalls.map((functionCall) => ({ functionCall })),
    ];
    return {
      text: data.message?.content ?? '',
      functionCalls,
      ...(functionCalls.length ? { candidateContent: { role: 'model', parts } } : {}),
    };
  }
}
