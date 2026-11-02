import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import path from 'node:path';
import type { Express } from 'express';
import type { Server } from 'node:http';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import request from 'supertest';
import { Client as PgClient } from 'pg';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { app as mcpApp, sessions } from '../src/app.js';

const loadBackendModule = createRequire(path.resolve(process.cwd(), 'mcp-integration-test.cjs'));
const backendBuild = path.resolve(process.cwd(), '../backend/dist/src');
const backendApp = (loadBackendModule(path.join(backendBuild, 'app.js')) as { app: Express }).app;
const backendModels = loadBackendModule(path.join(backendBuild, 'models/index.js')) as {
  sequelize: { authenticate(): Promise<void>; sync(): Promise<void>; close(): Promise<void> };
};

const ownerEmail = `mcp-owner-${randomUUID()}@example.test`;
const otherEmail = `mcp-other-${randomUUID()}@example.test`;
const movieId = randomUUID();
const cinemaId = randomUUID();
const showId = randomUUID();
const bookingId = randomUUID();
const paymentId = randomUUID();
const seatId = randomUUID();

let database: PgClient;
let backendServer: Server;
let mcpServer: Server;
let mcpUrl: string;
let ownerClient: Client;
let otherClient: Client;
let ownerUserId: string;
let otherUserId: string;
let ownerToken: string;
let otherToken: string;

function addressOf(server: Server): string {
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Server did not bind to a TCP port');
  return `http://127.0.0.1:${address.port}`;
}

function tokenFromLogin(response: request.Response): string {
  const cookieHeader = response.headers['set-cookie'];
  const cookies = Array.isArray(cookieHeader) ? cookieHeader : [cookieHeader];
  const authCookie = cookies.find((cookie) => cookie?.startsWith('cinemate_token='));
  if (!authCookie) throw new Error('Backend login did not issue a JWT cookie');
  return authCookie.slice('cinemate_token='.length).split(';')[0];
}

async function connectMcpClient(token: string, name: string): Promise<Client> {
  const client = new Client({ name, version: '1.0.0' }, { capabilities: {} });
  const transport = new StreamableHTTPClientTransport(new URL(mcpUrl), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  await client.connect(transport);
  return client;
}

function textFrom(result: CallToolResult): string {
  const block = result.content.find((item) => item.type === 'text');
  if (!block || block.type !== 'text') throw new Error('Tool did not return text content');
  return block.text;
}

function jsonFrom<T>(result: CallToolResult): T {
  return JSON.parse(textFrom(result)) as T;
}

describe('CineMate authenticated MCP tools over Streamable HTTP', () => {
  beforeAll(async () => {
    const connectionString = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
    if (!connectionString) throw new Error('Set TEST_DATABASE_URL or DATABASE_URL in backend/.env');
    await backendModels.sequelize.authenticate();
    await backendModels.sequelize.sync();

    database = new PgClient({ connectionString });
    await database.connect();

    backendServer = backendApp.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      backendServer.once('listening', resolve);
      backendServer.once('error', reject);
    });
    process.env.BACKEND_BASE_URL = addressOf(backendServer);

    mcpServer = mcpApp.listen(0, '127.0.0.1');
    await new Promise<void>((resolve, reject) => {
      mcpServer.once('listening', resolve);
      mcpServer.once('error', reject);
    });
    mcpUrl = `${addressOf(mcpServer)}/mcp`;

    const ownerRegistration = await request(backendApp).post('/api/auth/register').send({
      name: 'MCP Owner', email: ownerEmail, password: 'McpPassword123!',
    });
    expect(ownerRegistration.status).toBe(201);
    ownerUserId = ownerRegistration.body.data.id as string;
    const ownerLogin = await request(backendApp).post('/api/auth/login').send({
      email: ownerEmail, password: 'McpPassword123!',
    });
    ownerToken = tokenFromLogin(ownerLogin);

    const otherRegistration = await request(backendApp).post('/api/auth/register').send({
      name: 'MCP Other', email: otherEmail, password: 'McpPassword123!',
    });
    expect(otherRegistration.status).toBe(201);
    otherUserId = otherRegistration.body.data.id as string;
    const otherLogin = await request(backendApp).post('/api/auth/login').send({
      email: otherEmail, password: 'McpPassword123!',
    });
    otherToken = tokenFromLogin(otherLogin);

    const now = new Date();
    await database.query(
      'INSERT INTO movies (id, title, description, duration_minutes, genre, language, release_date, rating, poster_url, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL, $9, $9)',
      [movieId, 'MCP Test Feature', 'Integration fixture for MCP tools.', 112, 'Science Fiction', 'English', '2025-01-01', '8.4', now],
    );
    await database.query(
      'INSERT INTO cinemas (id, name, address, city, timezone, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [cinemaId, 'MCP Test Cinema', '1 Integration Way', 'Austin', 'America/Chicago', now],
    );
    await database.query(
      'INSERT INTO shows (id, movie_id, cinema_id, starts_at, ends_at, screen_name, total_seats, price, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $9)',
      [showId, movieId, cinemaId, new Date(Date.now() + 86_400_000), new Date(Date.now() + 93_600_000), 'Screen MCP', 50, '12.50', now],
    );
    await database.query(
      'INSERT INTO bookings (id, user_id, show_id, status, total_amount, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [bookingId, ownerUserId, showId, 'confirmed', '12.50', now],
    );
    await database.query(
      'INSERT INTO booking_seats (id, booking_id, show_id, seat_number, price, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $6)',
      [seatId, bookingId, showId, 'M1', '12.50', now],
    );
    await database.query(
      'INSERT INTO payments (id, booking_id, amount, currency, status, provider, provider_reference, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)',
      [paymentId, bookingId, '12.50', 'USD', 'succeeded', 'test-provider', 'SECRET-REFERENCE-TEST', now],
    );
    ownerClient = await connectMcpClient(ownerToken, 'cinemate-owner-test');
    otherClient = await connectMcpClient(otherToken, 'cinemate-other-test');
  });

  afterAll(async () => {
    await ownerClient?.close().catch(() => undefined);
    await otherClient?.close().catch(() => undefined);
    if (database) {
      await database.query('DELETE FROM bookings WHERE id = $1', [bookingId]);
      await database.query('DELETE FROM shows WHERE id = $1', [showId]);
      await database.query('DELETE FROM cinemas WHERE id = $1', [cinemaId]);
      await database.query('DELETE FROM movies WHERE id = $1', [movieId]);
      await database.query('DELETE FROM users WHERE email = ANY($1::text[])', [[ownerEmail, otherEmail]]);
    }
    await database?.end().catch(() => undefined);
    await new Promise<void>((resolve) => backendServer?.close(() => resolve()));
    await new Promise<void>((resolve) => mcpServer?.close(() => resolve()));
    await backendModels.sequelize.close();
    for (const [sessionId, session] of sessions) {
      sessions.delete(sessionId);
      await session.transport.close().catch(() => undefined);
    }
  });

  it('requires a verified JWT before creating an MCP session', async () => {
    const response = await fetch(mcpUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {
        protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'unauthenticated', version: '1.0' },
      } }),
    });
    expect(response.status).toBe(401);
  });

  it('binds each MCP session to the JWT subject that initialized it', async () => {
    const ownerSessionId = [...sessions.keys()][0];
    expect(ownerSessionId).toBeDefined();
    const response = await fetch(mcpUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${otherToken}`,
        'mcp-session-id': ownerSessionId!,
        Accept: 'text/event-stream',
      },
    });
    expect(response.status).toBe(403);
  });

  it('registers and validates all six tools with strict schemas', async () => {
    const listed = await ownerClient.listTools();
    expect(listed.tools.map((tool) => tool.name).sort()).toEqual([
      'get_booking_details', 'get_movie_details', 'get_my_bookings', 'get_my_profile', 'get_payment_status', 'search_movies',
    ]);
    const invalid = await ownerClient.callTool({ name: 'get_my_bookings', arguments: { userId: otherUserId } });
    expect(invalid.isError).toBe(true);
  });

  it('returns only the authenticated user’s public profile', async () => {
    const result = await ownerClient.callTool({ name: 'get_my_profile', arguments: {} });
    const profile = jsonFrom<{ data: { id: string; name: string; email: string } }>(result);
    expect(profile.data).toMatchObject({ id: ownerUserId, email: ownerEmail });
    expect(profile.data).not.toHaveProperty('passwordHash');
    expect(profile.data).not.toHaveProperty('password_hash');
  });

  it('searches movies by title, genre, and language', async () => {
    const result = await ownerClient.callTool({ name: 'search_movies', arguments: {
      title: 'MCP Test', genre: 'Science Fiction', language: 'English',
    } });
    const payload = jsonFrom<{ data: Array<{ id: string; title: string }> }>(result);
    expect(payload.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: movieId, title: 'MCP Test Feature' })]));
  });

  it('gets complete movie details', async () => {
    const result = await ownerClient.callTool({ name: 'get_movie_details', arguments: { movie_id: movieId } });
    const payload = jsonFrom<{ data: { title: string; shows: Array<{ cinema: { name: string } }> } }>(result);
    expect(payload.data.title).toBe('MCP Test Feature');
    expect(payload.data.shows[0].cinema.name).toBe('MCP Test Cinema');
  });

  it('lists only the authenticated user’s bookings and supports status filtering', async () => {
    const result = await ownerClient.callTool({ name: 'get_my_bookings', arguments: { status: 'confirmed' } });
    const payload = jsonFrom<{ data: Array<{ id: string; status: string }> }>(result);
    expect(payload.data).toEqual(expect.arrayContaining([expect.objectContaining({ id: bookingId, status: 'confirmed' })]));
    const otherResult = await otherClient.callTool({ name: 'get_my_bookings', arguments: {} });
    const otherPayload = jsonFrom<{ data: Array<{ id: string }> }>(otherResult);
    expect(otherPayload.data).toHaveLength(0);
  });

  it('returns booking details only to its owner', async () => {
    const owned = await ownerClient.callTool({ name: 'get_booking_details', arguments: { booking_id: bookingId } });
    expect(jsonFrom<{ data: { id: string } }>(owned).data.id).toBe(bookingId);
    const denied = await otherClient.callTool({ name: 'get_booking_details', arguments: { booking_id: bookingId } });
    expect(denied.isError).toBe(true);
    expect(textFrom(denied)).toMatch(/not found or is not accessible/i);
  });

  it('returns safe payment status only to the booking owner', async () => {
    const owned = await ownerClient.callTool({ name: 'get_payment_status', arguments: { booking_id: bookingId } });
    const payload = jsonFrom<{ data: { payment: { status: string; providerReference?: string } } }>(owned);
    expect(payload.data.payment.status).toBe('succeeded');
    expect(payload.data.payment).not.toHaveProperty('providerReference');
    const denied = await otherClient.callTool({ name: 'get_payment_status', arguments: { booking_id: bookingId } });
    expect(denied.isError).toBe(true);
  });
});
