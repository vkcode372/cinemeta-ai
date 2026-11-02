import { OllamaConfigurationError, loadOllamaConfig } from '../src/llm/ollama.config.js';
import { OllamaProvider, OllamaProviderError } from '../src/llm/ollama.provider.js';

describe('Ollama provider', () => {
  it('loads the default local endpoint and configured model', () => {
    expect(loadOllamaConfig({} as NodeJS.ProcessEnv)).toEqual({
      baseUrl: 'http://127.0.0.1:11434', model: 'llama3.1:8b',
    });
    expect(loadOllamaConfig({ OLLAMA_BASE_URL: 'http://ollama:11434/', OLLAMA_MODEL: 'qwen2.5:7b' } as NodeJS.ProcessEnv))
      .toEqual({ baseUrl: 'http://ollama:11434', model: 'qwen2.5:7b' });
    expect(() => loadOllamaConfig({ OLLAMA_BASE_URL: 'bad-url' } as NodeJS.ProcessEnv)).toThrow(OllamaConfigurationError);
  });

  it('calls the configured Ollama chat endpoint and maps tool calls', async () => {
    const fetchMock = jest.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      message: { content: 'Searching now.', tool_calls: [{ function: { name: 'search_movies', arguments: { title: 'Avatar' } } }] },
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const provider = new OllamaProvider({ baseUrl: 'http://ollama:11434', model: 'qwen2.5:7b' }, fetchMock);

    const result = await provider.generateResponse([{ role: 'user', parts: [{ text: 'Find Avatar' }] }], {
      functionDeclarations: [{ name: 'search_movies', parametersJsonSchema: { type: 'object', properties: { title: { type: 'string' } } } }],
    });

    expect(fetchMock).toHaveBeenCalledWith('http://ollama:11434/api/chat', expect.objectContaining({ method: 'POST' }));
    expect(result).toMatchObject({ text: 'Searching now.', functionCalls: [{ name: 'search_movies', args: { title: 'Avatar' } }] });
    expect(result.candidateContent?.role).toBe('model');
  });

  it('includes Ollama response detail for missing models and maps server failures', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://ollama:11434', model: 'missing-model' },
      jest.fn(async () => new Response('{"error":"model missing-model not found, pull it first"}', { status: 404 })));

    await expect(provider.generateResponse([{ role: 'user', parts: [{ text: 'Hello' }] }]))
      .rejects.toMatchObject({
        name: 'OllamaProviderError', statusCode: 404,
        message: 'Ollama request failed (404): {"error":"model missing-model not found, pull it first"}',
      });
  });

  it('marks connection failures retryable', async () => {
    const provider = new OllamaProvider({ baseUrl: 'http://ollama:11434', model: 'qwen2.5:7b' },
      jest.fn(async () => { throw new Error('connection refused'); }));
    await expect(provider.generateResponse([{ role: 'user', parts: [{ text: 'Hello' }] }]))
      .rejects.toBeInstanceOf(OllamaProviderError);
    await expect(provider.generateResponse([{ role: 'user', parts: [{ text: 'Hello' }] }]))
      .rejects.toMatchObject({ retryable: true, message: 'Ollama server is unavailable' });
  });
});
