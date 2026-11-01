import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Express } from 'express';
import type { Server } from 'node:http';
import type { Content, FunctionCall, Part } from '@google/genai';
import { Client as PgClient } from 'pg';
import request from 'supertest';
import type { LlmInterface, LlmResponse } from '../src/llm/llm.interface.js';
import { GeminiProviderError } from '../src/llm/gemini.provider.js';
import { createChatApp } from '../src/server/chat-app.js';

const jwtSecret = process.env.JWT_SECRET ?? 'e2e-jwt-secret-must-be-at-least-thirty-two-characters';
process.env.JWT_SECRET = jwtSecret;
const loadBuilt = createRequire(path.resolve(process.cwd(), 'cinemate-e2e.cjs'));
const backendBuild = path.resolve(process.cwd(), '../backend/dist/src');
const mcpBuild = path.resolve(process.cwd(), '../mcp-server/dist');
const backendApp = (loadBuilt(path.join(backendBuild, 'app.js')) as { app: Express }).app;
const mcpModule = loadBuilt(path.join(mcpBuild, 'app.js')) as {
  app: Express;
  sessions: Map<string, { transport: { close(): Promise<void> } }>;
};
const backendModels = loadBuilt(path.join(backendBuild, 'models/index.js')) as {
  sequelize: { authenticate(): Promise<void>; sync(): Promise<void>; close(): Promise<void> };
};

const databaseUrl = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL in backend/.env');

const ids = {
  movie: randomUUID(), cinema: randomUUID(), show: randomUUID(),
  userOneBooking: randomUUID(), userOneSeat: randomUUID(), userOnePayment: randomUUID(),
  userTwoBooking: randomUUID(), userTwoSeat: randomUUID(), userTwoPayment: randomUUID(),
};
const emails = [`e2e-${randomUUID()}@example.test`, `e2e-${randomUUID()}@example.test`];
const password = 'E2E-Strong-Password-123!';
const serviceToken = 'e2e-ai-service-token-must-be-at-least-thirty-two';
const serviceProviders: ScriptedGemini[] = [];
let database: PgClient;
let backendServer: Server;
let mcpServer: Server;
let aiServer: Server;
let primaryAiApp: Express;
let unavailableMcpAiServer: Server;
let unavailableGeminiAiServer: Server;
let backendUrl: string;
let mcpUrl: string;
let userOneId: string;
let userTwoId: string;
let userOneCookie: string;
let userTwoCookie: string;

function addressOf(server: Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Test service did not bind to a TCP port');
  return `http://127.0.0.1:${address.port}`;
}

async function start(app: Express): Promise<Server> {
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  return server;
}

function cookieFrom(response: request.Response): string {
  const headers = response.headers['set-cookie'];
  const cookie = (Array.isArray(headers) ? headers : [headers]).find((value) => value?.startsWith('cinemate_token='));
  if (!cookie) throw new Error('Login response did not set the HttpOnly auth cookie');
  return cookie.split(';')[0];
}

function newestUserMessage(contents: Content[]): string {
  for (let index = contents.length - 1; index >= 0; index -= 1) {
    const text = contents[index].parts?.find((part) => typeof part.text === 'string')?.text;
    if (contents[index].role === 'user' && text) return text;
  }
  return '';
}

function latestToolResponses(contents: Content[]): Part[] {
  const parts = contents.at(-1)?.parts ?? [];
  return parts.some((part) => part.functionResponse) ? parts : [];
}

class ScriptedGemini implements LlmInterface {
  readonly requests: Content[][] = [];
  readonly toolBatches: string[][] = [];

  async generateResponse(contents: Content[]): Promise<LlmResponse> {
    this.requests.push(structuredClone(contents));
    const responses = latestToolResponses(contents);
    if (responses.length) {
      const names = responses.flatMap((part) => part.functionResponse?.name ? [part.functionResponse.name] : []);
      this.toolBatches.push(names);
      if (names.includes('get_payment_status')) return { text: 'Your latest payment succeeded.', functionCalls: [] };
      if (names.includes('get_booking_details') && names.length === 1) return { text: 'That booking is not available on this account.', functionCalls: [] };
      if (names.includes('get_movie_details')) return { text: 'Avatar is a science fiction feature, rated 7.9.', functionCalls: [] };
      if (names.includes('get_my_bookings')) return { text: 'I found your booking details.', functionCalls: [] };
      if (names.includes('search_movies') && names.length === 1) return { text: 'I found Avatar in the movie catalog.', functionCalls: [] };
      return { text: 'I checked the movie and your bookings.', functionCalls: [] };
    }

    const prompt = newestUserMessage(contents).toLowerCase();
    if (prompt.includes('payment') || prompt.includes('latest payment')) return this.call('get_payment_status', { booking_id: ids.userOneBooking });
    if (prompt.includes('booking') && /[0-9a-f-]{36}/i.test(prompt)) {
      const bookingId = prompt.match(/[0-9a-f-]{36}/i)?.[0] ?? ids.userOneBooking;
      return this.call('get_booking_details', { booking_id: bookingId });
    }
    if (prompt.includes('details') || prompt.includes('tell me more')) return this.call('get_movie_details', { movie_id: ids.movie });
    if (prompt.includes('and show my bookings') || prompt.includes('also list bookings')) {
      return this.calls([
        { name: 'search_movies', args: { title: 'Avatar' } },
        { name: 'get_my_bookings', args: {} },
      ]);
    }
    if (prompt.includes('booking')) return this.call('get_my_bookings', {});
    if (prompt.includes('avatar') || prompt.includes('movie')) return this.call('search_movies', { title: 'Avatar' });
    return { text: 'I can help with films, your bookings, or payment status.', functionCalls: [] };
  }

  private call(name: string, args: Record<string, unknown>): LlmResponse {
    const functionCall: FunctionCall = { id: randomUUID(), name, args };
    return { functionCalls: [functionCall], candidateContent: { role: 'model', parts: [{ functionCall }] } };
  }

  private calls(calls: FunctionCall[]): LlmResponse {
    return { functionCalls: calls, candidateContent: { role: 'model', parts: calls.map((functionCall) => ({ functionCall })) } };
  }
}

function chatApp(providerFactory: () => LlmInterface, toolUrl = mcpUrl) {
  return createChatApp({ jwtSecret, serviceToken, mcpServerUrl: toolUrl, providerFactory });
}

async function closeServer(server?: Server): Promise<void> {
  if (server?.listening) await new Promise<void>((resolve) => server.close(() => resolve()));
}

describe('CineMate end-to-end: backend, agent runtime, MCP, and PostgreSQL', () => {
  beforeAll(async () => {
    process.env.JWT_SECRET = jwtSecret;
    process.env.AI_CLIENT_SERVICE_TOKEN = serviceToken;
    await backendModels.sequelize.authenticate();
    await backendModels.sequelize.sync();
    database = new PgClient({ connectionString: databaseUrl });
    await database.connect();

    backendServer = await start(backendApp);
    backendUrl = addressOf(backendServer);
    process.env.BACKEND_BASE_URL = backendUrl;
    process.env.AI_CLIENT_SERVICE_TOKEN = serviceToken;

    mcpServer = await start(mcpModule.app);
    mcpUrl = `${addressOf(mcpServer)}/mcp`;
    primaryAiApp = chatApp(() => {
      const provider = new ScriptedGemini();
      serviceProviders.push(provider);
      return provider;
    });
    aiServer = await start(primaryAiApp);
    process.env.AI_CLIENT_BASE_URL = addressOf(aiServer);

    const registrations = await Promise.all(emails.map((email, index) => request(backendUrl)
      .post('/api/auth/register')
      .send({ name: `E2E Viewer ${index + 1}`, email, password })));
    expect(registrations.map((response) => response.status)).toEqual([201, 201]);
    [userOneId, userTwoId] = registrations.map((response) => response.body.data.id as string);

    const logins = await Promise.all(emails.map((email) => request(backendUrl)
      .post('/api/auth/login').send({ email, password })));
    expect(logins.map((response) => response.status)).toEqual([200, 200]);
    userOneCookie = cookieFrom(logins[0]);
    userTwoCookie = cookieFrom(logins[1]);
    expect(logins[0].headers['set-cookie'][0]).toContain('HttpOnly');
    expect(logins[0].headers['set-cookie'][0]).toContain('SameSite=Strict');

    const timestamp = new Date();
    await database.query(
      'INSERT INTO movies (id,title,description,duration_minutes,genre,language,release_date,rating,poster_url,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NULL,$9,$9)',
      [ids.movie, 'Avatar', 'An explorer discovers an unfamiliar world.', 162, 'Science Fiction', 'English', '2009-12-18', '7.9', timestamp],
    );
    await database.query(
      'INSERT INTO cinemas (id,name,address,city,timezone,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6)',
      [ids.cinema, 'E2E Grand Cinema', '18 Screen Street', 'Austin', 'America/Chicago', timestamp],
    );
    await database.query(
      'INSERT INTO shows (id,movie_id,cinema_id,starts_at,ends_at,screen_name,total_seats,price,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)',
      [ids.show, ids.movie, ids.cinema, new Date(Date.now() + 86_400_000), new Date(Date.now() + 93_600_000), 'Screen E2E', 60, '14.00', timestamp],
    );
    await database.query(
      'INSERT INTO bookings (id,user_id,show_id,status,total_amount,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6),($7,$8,$3,$4,$9,$6,$6)',
      [ids.userOneBooking, userOneId, ids.show, 'confirmed', '14.00', timestamp, ids.userTwoBooking, userTwoId, '28.00'],
    );
    await database.query(
      'INSERT INTO booking_seats (id,booking_id,show_id,seat_number,price,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$6),($7,$8,$3,$9,$10,$6,$6)',
      [ids.userOneSeat, ids.userOneBooking, ids.show, 'A1', '14.00', timestamp, ids.userTwoSeat, ids.userTwoBooking, 'D4', '28.00'],
    );
    await database.query(
      'INSERT INTO payments (id,booking_id,amount,currency,status,provider,provider_reference,created_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8),($9,$10,$11,$4,$12,$6,$13,$8,$8)',
      [ids.userOnePayment, ids.userOneBooking, '14.00', 'USD', 'succeeded', 'test', 'private-user-one-ref', timestamp, ids.userTwoPayment, ids.userTwoBooking, '28.00', 'pending', 'private-user-two-ref'],
    );
  }, 30_000);

  afterAll(async () => {
    await (primaryAiApp?.locals.closeSessions as (() => Promise<void>) | undefined)?.();
    if (database) {
      await database.query('DELETE FROM payments WHERE id = ANY($1::uuid[])', [[ids.userOnePayment, ids.userTwoPayment]]);
      await database.query('DELETE FROM booking_seats WHERE id = ANY($1::uuid[])', [[ids.userOneSeat, ids.userTwoSeat]]);
      await database.query('DELETE FROM bookings WHERE id = ANY($1::uuid[])', [[ids.userOneBooking, ids.userTwoBooking]]);
      await database.query('DELETE FROM shows WHERE id = $1', [ids.show]);
      await database.query('DELETE FROM cinemas WHERE id = $1', [ids.cinema]);
      await database.query('DELETE FROM movies WHERE id = $1', [ids.movie]);
      await database.query('DELETE FROM users WHERE id = ANY($1::uuid[])', [[userOneId, userTwoId].filter(Boolean)]);
      await database.end();
    }
    await Promise.all([closeServer(aiServer), closeServer(unavailableMcpAiServer), closeServer(unavailableGeminiAiServer), closeServer(mcpServer), closeServer(backendServer)]);
    await backendModels.sequelize.close();
  }, 30_000);

  it('registers and logs in two users, then serves separate booking lists', async () => {
    const userOne = await request(backendUrl).get('/api/bookings/').set('Cookie', userOneCookie);
    const userTwo = await request(backendUrl).get('/api/bookings/').set('Cookie', userTwoCookie);
    expect(userOne.body.data.map((booking: { id: string }) => booking.id)).toContain(ids.userOneBooking);
    expect(userOne.body.data.map((booking: { id: string }) => booking.id)).not.toContain(ids.userTwoBooking);
    expect(userTwo.body.data.map((booking: { id: string }) => booking.id)).toContain(ids.userTwoBooking);
    expect((await request(backendUrl).get('/api/auth/me').set('Cookie', userOneCookie)).body.data).toEqual({
      id: userOneId, name: 'E2E Viewer 1', email: emails[0],
    });
  });

  it('uses Gemini function calls and real MCP/backend data for movie search, details, and follow-up context', async () => {
    const conversationId = randomUUID();
    const search = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId, message: 'Search Avatar' });
    expect(search.status).toBe(200);
    expect(search.body.data.text).toContain('Avatar');
    expect(search.body.data.toolCalls.map((tool: { name: string }) => tool.name)).toEqual(['search_movies']);

    const details = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId, message: 'Tell me more about that movie.' });
    expect(details.status).toBe(200);
    expect(details.body.data.toolCalls.map((tool: { name: string }) => tool.name)).toEqual(['get_movie_details']);
    expect(serviceProviders[0].requests[1].some((content) => content.parts?.some((part) => Boolean(part.functionResponse)))).toBe(true);
    expect(serviceProviders[0].requests.at(-1)?.some((content) => content.role === 'user' && content.parts?.some((part) => part.text?.includes('Tell me more')))).toBe(true);
  });

  it('retrieves bookings, booking details, then payment status in a contextual follow-up', async () => {
    const conversationId = randomUUID();
    const bookings = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId, message: 'Show my bookings.' });
    expect(bookings.body.data.toolCalls.map((tool: { name: string }) => tool.name)).toContain('get_my_bookings');

    const detailConversation = randomUUID();
    const booking = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId: detailConversation, message: `Show booking ${ids.userOneBooking}` });
    expect(booking.body.data.toolCalls.map((tool: { name: string }) => tool.name)).toContain('get_booking_details');

    const payment = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId, message: 'What about my latest payment?' });
    expect(payment.status).toBe(200);
    expect(payment.body.data.toolCalls.map((tool: { name: string }) => tool.name)).toContain('get_payment_status');
    expect(payment.body.data.text).toContain('succeeded');
    const paymentResponse = serviceProviders[1].requests.at(-1)?.flatMap((content) => content.parts ?? [])
      .find((part) => part.functionResponse?.name === 'get_payment_status')?.functionResponse?.response;
    expect(JSON.stringify(paymentResponse)).not.toContain('private-user-one-ref');
  });

  it('executes multiple discovered MCP tools sequentially in one model response', async () => {
    const response = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId: randomUUID(), message: 'Search Avatar and show my bookings.' });
    expect(response.status).toBe(200);
    expect(response.body.data.toolCalls.map((tool: { name: string }) => tool.name)).toEqual(['search_movies', 'get_my_bookings']);
    const provider = serviceProviders.at(-1);
    expect(provider?.toolBatches[0]).toEqual(['search_movies', 'get_my_bookings']);
  });

  it('denies another user booking and payment access through the API and AI tools', async () => {
    expect((await request(backendUrl).get(`/api/bookings/${ids.userOneBooking}`).set('Cookie', userTwoCookie)).status).toBe(404);
    expect((await request(backendUrl).get(`/api/payments/bookings/${ids.userOneBooking}/status`).set('Cookie', userTwoCookie)).status).toBe(404);

    const response = await request(backendUrl).post('/api/ai/chat').set('Cookie', userTwoCookie)
      .send({ conversationId: randomUUID(), message: `Show booking ${ids.userOneBooking}` });
    expect(response.status).toBe(200);
    expect(response.body.data.toolErrors).toEqual(expect.arrayContaining([expect.objectContaining({ name: 'get_booking_details' })]));
    expect(response.body.data.text).toContain('not available on this account');
  });

  it('rejects missing authentication and userId supplied by the browser', async () => {
    const input = { conversationId: randomUUID(), message: 'Show my bookings.' };
    expect((await request(backendUrl).post('/api/ai/chat').send(input)).status).toBe(401);
    expect((await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ ...input, userId: userTwoId })).status).toBe(400);
  });

  it('returns actionable errors when MCP or Gemini is unavailable', async () => {
    const brokenMcpApp = chatApp(() => new ScriptedGemini(), 'http://127.0.0.1:1/mcp');
    unavailableMcpAiServer = await start(brokenMcpApp);
    process.env.AI_CLIENT_BASE_URL = addressOf(unavailableMcpAiServer);
    const mcpFailure = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId: randomUUID(), message: 'Search Avatar' });
    expect(mcpFailure.status).toBe(503);
    expect(mcpFailure.body).toEqual(expect.objectContaining({ error: expect.objectContaining({ message: expect.stringMatching(/movie search and booking tools are temporarily unavailable/i) }) }));
    await (brokenMcpApp.locals.closeSessions as () => Promise<void>)();
    await closeServer(unavailableMcpAiServer);

    const failedProvider: LlmInterface = {
      async generateResponse() { throw new GeminiProviderError('Gemini API request failed', 503, true); },
    };
    const brokenGeminiApp = chatApp(() => failedProvider);
    unavailableGeminiAiServer = await start(brokenGeminiApp);
    process.env.AI_CLIENT_BASE_URL = addressOf(unavailableGeminiAiServer);
    const geminiFailure = await request(backendUrl).post('/api/ai/chat').set('Cookie', userOneCookie)
      .send({ conversationId: randomUUID(), message: 'Search Avatar' });
    expect(geminiFailure.status).toBe(503);
    expect(geminiFailure.body.error.message).toMatch(/AI service could not complete that request/i);
    await (brokenGeminiApp.locals.closeSessions as () => Promise<void>)();
    await closeServer(unavailableGeminiAiServer);
    process.env.AI_CLIENT_BASE_URL = addressOf(aiServer);
  });
});
