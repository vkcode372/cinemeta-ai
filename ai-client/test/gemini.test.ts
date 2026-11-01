import type { GenerateContentResponse } from '@google/genai';
import { GeminiConfigurationError, loadGeminiConfig } from '../src/llm/gemini.config.js';
import { GeminiProvider, GeminiProviderError, type GeminiSdkClient } from '../src/llm/gemini.provider.js';

function sdkReturning(response: unknown): GeminiSdkClient {
  return {
    models: {
      generateContent: jest.fn(async () => response as GenerateContentResponse),
    },
  };
}

describe('Gemini provider', () => {
  it('requires an API key and model from environment configuration', () => {
    expect(() => loadGeminiConfig({} as NodeJS.ProcessEnv)).toThrow(GeminiConfigurationError);
    expect(loadGeminiConfig({ GEMINI_API_KEY: 'private-test-key', GEMINI_MODEL: 'configured-model' } as NodeJS.ProcessEnv))
      .toEqual({ apiKey: 'private-test-key', model: 'configured-model' });
  });

  it('sends normal messages to the configured Gemini model', async () => {
    const generateContent = jest.fn(async () => ({
      text: 'Hello from Gemini.', functionCalls: [], candidates: [],
    } as unknown as GenerateContentResponse));
    const sdk: GeminiSdkClient = { models: { generateContent } };
    const provider = new GeminiProvider({ apiKey: 'private-test-key', model: 'configured-model' }, sdk);

    const result = await provider.generateResponse([{ role: 'user', parts: [{ text: 'Hello' }] }]);

    expect(result.text).toBe('Hello from Gemini.');
    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: 'configured-model' }));
  });

  it('reads text parts directly when Gemini returns text with a function call', async () => {
    const functionCall = { id: 'call-1', name: 'search_movies', args: { title: 'Avatar' } };
    const response = {
      get text(): string { throw new Error('There are non-text parts in the response'); },
      functionCalls: [functionCall],
      candidates: [{ content: { role: 'model', parts: [
        { text: 'I found a match. ' }, { functionCall }, { text: 'Let me get the details.' },
      ] } }],
    } as unknown as GenerateContentResponse;
    const provider = new GeminiProvider(
      { apiKey: 'private-test-key', model: 'configured-model' },
      sdkReturning(response),
    );

    await expect(provider.generateResponse([{ role: 'user', parts: [{ text: 'Find Avatar' }] }]))
      .resolves.toMatchObject({
        text: 'I found a match. Let me get the details.',
        functionCalls: [functionCall],
        candidateContent: response.candidates?.[0]?.content,
      });
  });

  it('maps invalid API key and rate-limit failures to safe provider errors', async () => {
    const invalidKey = new GeminiProvider({ apiKey: 'private-test-key', model: 'configured-model' }, sdkReturning(
      Promise.reject(Object.assign(new Error('API key not valid: do not disclose'), { status: 403 })),
    ));
    await expect(invalidKey.generateResponse([{ role: 'user', parts: [{ text: 'test' }] }]))
      .rejects.toMatchObject({ name: 'GeminiProviderError', message: 'Gemini rejected the API key', statusCode: 403 });

    const rateLimited = new GeminiProvider({ apiKey: 'private-test-key', model: 'configured-model' }, {
      models: { generateContent: jest.fn().mockRejectedValue(Object.assign(new Error('quota'), { status: 429 })) },
    });
    await expect(rateLimited.generateResponse([{ role: 'user', parts: [{ text: 'test' }] }]))
      .rejects.toBeInstanceOf(GeminiProviderError);
    await expect(rateLimited.generateResponse([{ role: 'user', parts: [{ text: 'test' }] }]))
      .rejects.toMatchObject({ statusCode: 429, retryable: true, message: 'Gemini rate limit reached; retry later' });
  });
});
