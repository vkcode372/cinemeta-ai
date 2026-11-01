import { FunctionCallingConfigMode, GoogleGenAI } from '@google/genai';
import type { Content, FunctionDeclaration, GenerateContentParameters, GenerateContentResponse } from '@google/genai';
import type { LlmInterface, LlmRequestOptions, LlmResponse } from './llm.interface.js';
import { loadGeminiConfig, type GeminiConfig } from './gemini.config.js';

export interface GeminiSdkClient {
  models: {
    generateContent(parameters: GenerateContentParameters): Promise<GenerateContentResponse>;
  };
}

export class GeminiProviderError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly retryable = false,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = 'GeminiProviderError';
  }
}

function errorStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = 'status' in error ? error.status : undefined;
  const code = 'code' in error ? error.code : undefined;
  if (typeof status === 'number') return status;
  if (typeof code === 'number') return code;
  if (code === 'RESOURCE_EXHAUSTED') return 429;
  if (code === 'UNAUTHENTICATED') return 401;
  if (code === 'PERMISSION_DENIED') return 403;
  return undefined;
}

function safeError(error: unknown): GeminiProviderError {
  const statusCode = errorStatus(error);
  const message = error instanceof Error ? error.message.toLowerCase() : '';
  if (statusCode === 401 || statusCode === 403 || message.includes('api key not valid') || message.includes('invalid api key')) {
    return new GeminiProviderError('Gemini rejected the API key', statusCode ?? 401, false, { cause: error });
  }
  if (statusCode === 429) {
    return new GeminiProviderError('Gemini rate limit reached; retry later', statusCode, true, { cause: error });
  }
  return new GeminiProviderError('Gemini API request failed', statusCode, statusCode !== undefined && statusCode >= 500, { cause: error });
}

export class GeminiProvider implements LlmInterface {
  private readonly client: GeminiSdkClient;

  constructor(private readonly config: GeminiConfig = loadGeminiConfig(), client?: GeminiSdkClient) {
    this.client = client ?? new GoogleGenAI({ apiKey: config.apiKey });
  }

  async generateResponse(contents: Content[], options: LlmRequestOptions = {}): Promise<LlmResponse> {
    const declarations = options.functionDeclarations;
    const config: GenerateContentParameters['config'] = declarations?.length
      ? {
          tools: [{ functionDeclarations: declarations }],
          toolConfig: {
            functionCallingConfig: {
              mode: options.disableFunctionCalling ? FunctionCallingConfigMode.NONE : FunctionCallingConfigMode.AUTO,
            },
          },
        }
      : undefined;

    try {
      const response = await this.client.models.generateContent({
        model: this.config.model,
        contents,
        ...(config ? { config } : {}),
      });
      // The SDK's `text` convenience accessor can throw when a candidate also
      // contains non-text parts (such as functionCall). Read the candidate parts
      // directly so mixed responses retain both their text and function calls.
      const candidateContent = response.candidates?.[0]?.content;
      const textParts = candidateContent?.parts
        ?.flatMap((part) => typeof part.text === 'string' ? [part.text] : []) ?? [];
      return {
        text: textParts.length ? textParts.join('') : (candidateContent ? undefined : response.text),
        functionCalls: response.functionCalls ?? [],
        candidateContent,
      };
    } catch (error) {
      throw safeError(error);
    }
  }
}

export type { FunctionDeclaration };
