import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { Client as PgClient } from 'pg';
import request from 'supertest';
import { McpClient } from '../src/client/mcp-client.js';
import { McpConnectionError, McpToolExecutionError } from '../src/errors.js';
import type { McpToolResult } from '../src/types/index.js';
import { runFunctionCallingTurn } from '../src/llm/function-calling.js';
import type { LlmInterface, LlmResponse } from '../src/llm/llm.interface.js';
import { OllamaProvider } from '../src/llm/ollama.provider.js';

const loadBuiltServer = createRequire(path.resolve(process.cwd(), 'ai-client-test.cjs'));
const backendBuild = path.resolve(process.cwd(), '../backend/dist/src');
const mcpBuild = path.resolve(process.cwd(), '../mcp-server/dist');
const backendApp = (loadBuiltServer(path.join(backendBuild, 'app.js')) as { app: Express }).app;
const mcpApp = (loadBuiltServer(path.join(mcpBuild, 'app.js')) as { app: Express }).app;
const backendModels = loadBuiltServer(path.join(backendBuild, 'models/index.js')) as {
  sequelize: { authenticate(): Promise<void>; sync(): Promise<void>; close(): Promise<void> };
};

const ownerEmail = `client-owner-${randomUUID()}@example.test`;
const otherEmail = `client-other-${randomUUID()}@example.test`;
const liveOllamaTest = process.env.RUN_LIVE_OLLAMA_TESTS === 'true' && process.env.OLLAMA_MODEL ? it : it.skip;
const movieId = randomUUID();
const avatarMovieId = randomUUID();
const cinemaId = randomUUID();
const showId = randomUUID();
const bookingId = randomUUID();
const seatId = randomUUID();

let database: PgClient;
let backendServer: Server;
let mcpServer: Server;
let serverUrl: string;
let ownerUserId: string;
let ownerToken: string;
let otherToken: string;
let ownerClient: McpClient;
let otherClient: McpClient;

function addressOf(server: Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
  return `http://127.0.0.1:${address.port}`;
}

function tokenFromLogin(response: request.Response): string {
  const header = response.headers['set-cookie'];
  const values = Array.isArray(header) ? header : [header];
  const cookie = values.find((value) => value?.startsWith('cinemate_token='));
  if (!cookie) throw new Error('Backend login did not issue an MCP JWT');
  return cookie.slice('cinemate_token='.length).split(';')[0];
}

function toolData<T>(result: McpToolResult): T {
  if (result.isError) throw new Error('Expected a successful tool result');
  if (!('content' in result)) throw new Error('Expected an immediate MCP tool result');
  const text = result.content.find((item) => item.type === 'text');
  if (!text || text.type !== 'text') throw new Error('MCP tool returned no text content');
  return JSON.parse(text.text) as T;
}

async function start(app: Express): Promise<Server> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server;
}

describe('independent authenticated MCP client', () => {
  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL in backend/.env');
    await backendModels.sequelize.authenticate();
    await backendModels.sequelize.sync();
    database = new PgClient({ connectionString });
    await database.connect();

    backendServer = await start(backendApp);
    process.env.BACKEND_BASE_URL = addressOf(backendServer);
    mcpServer = await start(mcpApp);
    serverUrl = `${addressOf(mcpServer)}/mcp`;

    const ownerRegistration = await request(backendApp).post('/api/auth/register').send({
      name: 'Client Owner', email: ownerEmail, password: 'ClientPassword123!',
    });
    expect(ownerRegistration.status).toBe(201);
    ownerUserId = ownerRegistration.body.data.id as string;
    const ownerLogin = await request(backendApp).post('/api/auth/login').send({
      email: ownerEmail, password: 'ClientPassword123!',
    });
    ownerToken = tokenFromLogin(ownerLogin);

    const otherRegistration = await request(backendApp).post('/api/auth/register').send({
      name: 'Client Other', email: otherEmail, password: 'ClientPassword123!',
    });
    expect(otherRegistration.status).toBe(201);
    const otherLogin = await request(backendApp).post('/api/auth/login').send({
      email: otherEmail, password: 'ClientPassword123!',
    });
    otherToken = tokenFromLogin(otherLogin);

    const now = new Date();
    await database.query(
      'INSERT INTO movies (id, title, description, duration_minutes, genre, language, release_date, rating, poster_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $9)',
      [movieId, 'Client Test Feature', 'Integration fixture for the independent client.', 104, 'Drama', 'English', '2025-02-01', '7.8', now],
    );
    await database.query(
      'INSERT INTO movies (id, title, description, duration_minutes, genre, language, release_date, rating, poster_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $9)',
      [avatarMovieId, 'Avatar', 'A traveler encounters a new world.', 162, 'Science Fiction', 'English', '2009-12-18', '7.9', now],
    );
    await database.query(
      'INSERT INTO cinemas (id, name, address, city, timezone, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [cinemaId, 'Client Test Cinema', '2 Client Way', 'Austin', 'America/Chicago', now],
    );
    await database.query(
      'INSERT INTO shows (id, movie_id, cinema_id, starts_at, ends_at, screen_name, total_seats, price, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)',
      [showId, movieId, cinemaId, new Date(Date.now() + 86_400_000), new Date(Date.now() + 93_600_000), 'Screen Client', 40, '11.00', now],
    );
    await database.query(
      'INSERT INTO bookings (id, user_id, show_id, status, total_amount, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [bookingId, ownerUserId, showId, 'confirmed', '11.00', now],
    );
    await database.query(
      'INSERT INTO booking_seats (id, booking_id, show_id, seat_number, price, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [seatId, bookingId, showId, 'C1', '11.00', now],
    );

    ownerClient = new McpClient({ serverUrl, accessToken: ownerToken });
    otherClient = new McpClient({ serverUrl, accessToken: otherToken });
    await ownerClient.connect();
    await otherClient.connect();
  });

  afterAll(async () => {
    await ownerClient?.close().catch(() => undefined);
    await otherClient?.close().catch(() => undefined);
    if (database) {
      await database.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await database.query('DELETE FROM shows WHERE id = $1', [showId]);
      await database.query('DELETE FROM cinemas WHERE id = $1', [cinemaId]);
      await database.query('DELETE FROM movies WHERE id = $1', [movieId]);
      await database.query('DELETE FROM movies WHERE id = $1', [avatarMovieId]);
      await database.query('DELETE FROM users WHERE email = ANY($1::text[])', [[ownerEmail, otherEmail]]);
      await database.end().catch(() => undefined);
    }
    await new Promise<void>((resolve) => backendServer?.close(() => resolve()));
    await new Promise<void>((resolve) => mcpServer?.close(() => resolve()));
    await backendModels.sequelize.close();
  });

  it('connects with a valid JWT and discovers all six MCP tools', async () => {
    expect(ownerClient.state).toBe('connected');
    const result = await ownerClient.listTools();
    expect(result.tools.map((tool) => tool.name).sort()).toEqual([
      'get_booking_details', 'get_movie_details', 'get_my_bookings', 'get_my_profile', 'get_payment_status', 'search_movies',
    ]);
  });

  it('executes search_movies and get_my_bookings', async () => {
    const movies = await ownerClient.callTool('search_movies', {
      title: 'Client Test', genre: 'Drama', language: 'English',
    });
    const movieData = toolData<{ data: Array<{ id: string }> }>(movies);
    expect(movieData.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: movieId })]));

    const bookings = await ownerClient.callTool('get_my_bookings', { status: 'confirmed' });
    const bookingData = toolData<{ data: Array<{ id: string }> }>(bookings);
    expect(bookingData.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: bookingId })]));
  });

  it('discovers tools dynamically, lets Gemini select search_movies for Avatar, executes it, and returns the result for a final response', async () => {
    const call = { id: 'avatar-call', name: 'search_movies', args: { title: 'Avatar', genre: 'Science Fiction', language: 'English' } };
    const generatedContents: Array<{
      contents: Parameters<LlmInterface['generateResponse']>[0];
      options?: Parameters<LlmInterface['generateResponse']>[1];
    }> = [];
    const responses: LlmResponse[] = [
      { functionCalls: [call], candidateContent: { role: 'model', parts: [{ functionCall: call }] } },
      { text: 'I found Avatar, a science fiction movie in English.', functionCalls: [] },
    ];
    const provider: LlmInterface = {
      async generateResponse(contents, options) {
        generatedContents.push({ contents, options });
        return responses.shift()!;
      },
    };

    const turn = await runFunctionCallingTurn(provider, ownerClient, 'Find Avatar in English.');

    expect(turn.text).toContain('I found Avatar');
    expect(turn.toolErrors).toEqual([]);
    expect(turn.toolCalls).toHaveLength(1);
    expect(turn.toolCalls[0].name).toBe('search_movies');
    const toolResult = toolData<{ data: Array<{ id: string }> }>(turn.toolCalls[0].result);
    expect(toolResult.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: avatarMovieId })]));
    const searchDeclaration = generatedContents[0].options?.functionDeclarations?.find((declaration) => declaration.name === 'search_movies');
    expect(generatedContents[0].options?.functionDeclarations?.map((declaration) => declaration.name)).toContain('search_movies');
    expect(searchDeclaration?.description).toContain('Search the movie catalog');
    expect(searchDeclaration?.parametersJsonSchema).toEqual(expect.objectContaining({
      type: 'object', properties: expect.objectContaining({ title: expect.any(Object), genre: expect.any(Object), language: expect.any(Object) }),
    }));
    expect(generatedContents[1].options?.disableFunctionCalling).toBe(true);
    const functionResult = generatedContents[1].contents[2].parts?.[0].functionResponse?.response;
    expect(functionResult?.output).toEqual(expect.objectContaining({ data: expect.arrayContaining([expect.objectContaining({ id: avatarMovieId })]) }));
  });

  it('rejects unknown tools and invalid Gemini arguments without executing them', async () => {
    const executeTool = jest.spyOn(ownerClient, 'callTool');
    const unknownResponses: LlmResponse[] = [{ functionCalls: [{ name: 'delete_booking', args: { booking_id: bookingId } }] }];
    const unknownProvider: LlmInterface = {
      async generateResponse() { return unknownResponses.shift()!; },
    };
    const unknown = await runFunctionCallingTurn(unknownProvider, ownerClient, 'Delete my booking.');
    expect(unknown.toolErrors[0].message).toContain('Unknown tool request rejected');
    expect(executeTool).not.toHaveBeenCalled();

    const invalidResponses: LlmResponse[] = [
      { functionCalls: [{ name: 'search_movies', args: { title: 'Avatar', userId: otherEmail } }] },
      { text: 'I could not perform that search request.', functionCalls: [] },
    ];
    const invalidProvider: LlmInterface = {
      async generateResponse() { return invalidResponses.shift()!; },
    };
    const invalid = await runFunctionCallingTurn(invalidProvider, ownerClient, 'Search for Avatar.');
    expect(invalid.toolErrors[0].message).toContain('Invalid function arguments');
    expect(executeTool).not.toHaveBeenCalled();
    executeTool.mockRestore();
  });

  it('returns invalid MCP tool results to Gemini as function errors', async () => {
    const callTool = jest.spyOn(ownerClient, 'callTool').mockResolvedValueOnce({ content: [] } as unknown as McpToolResult);
    const responses: LlmResponse[] = [
      { functionCalls: [{ name: 'search_movies', args: { title: 'Avatar' } }] },
      { text: 'The movie service returned an unusable result.', functionCalls: [] },
    ];
    const provider: LlmInterface = { async generateResponse() { return responses.shift()!; } };

    const turn = await runFunctionCallingTurn(provider, ownerClient, 'Search Avatar.');

    expect(turn.toolErrors[0].message).toContain('invalid empty result');
    expect(callTool).toHaveBeenCalledTimes(1);
    callTool.mockRestore();
  });

  it('rejects unauthorized access to another user’s booking', async () => {
    await expect(otherClient.callTool('get_booking_details', { booking_id: bookingId }))
      .rejects.toBeInstanceOf(McpToolExecutionError);
  });

  it('rejects an invalid JWT during connection', async () => {
    const client = new McpClient({ serverUrl, accessToken: 'invalid-token' });
    await expect(client.connect()).rejects.toBeInstanceOf(McpConnectionError);
    expect(client.state).toBe('disconnected');
  });

  liveOllamaTest('live Ollama selects search_movies for Avatar and produces a final response', async () => {
    const turn = await runFunctionCallingTurn(
      new OllamaProvider(),
      ownerClient,
      'Search the movie catalog for Avatar and tell me its genre and language.',
    );
    expect(turn.toolCalls.map((call) => call.name)).toContain('search_movies');
    expect(turn.text.length).toBeGreaterThan(0);
  }, 60_000);

  it('reports connection errors and manages the MCP session lifecycle', async () => {
    const unavailable = new McpClient({ serverUrl: 'http://127.0.0.1:1/mcp', accessToken: ownerToken });
    await expect(unavailable.connect()).rejects.toBeInstanceOf(McpConnectionError);
    expect(unavailable.state).toBe('disconnected');

    await ownerClient.close();
    expect(ownerClient.state).toBe('disconnected');
  });
});
