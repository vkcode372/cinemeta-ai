import type { Content, FunctionDeclaration } from '@google/genai';

export interface LlmFunctionCall {
  id?: string;
  name?: string;
  args?: Record<string, unknown>;
}

export interface LlmResponse {
  text?: string;
  functionCalls: LlmFunctionCall[];
  candidateContent?: Content;
}

export interface LlmRequestOptions {
  functionDeclarations?: FunctionDeclaration[];
  disableFunctionCalling?: boolean;
}

export interface LlmInterface {
  generateResponse(contents: Content[], options?: LlmRequestOptions): Promise<LlmResponse>;
}
