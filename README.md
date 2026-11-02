# CineMate AI

An AI-powered movie booking assistant monorepo with a local demo booking flow, account-scoped booking data, and Ollama-powered chat.

## Architecture

```text
browser (Next.js / React)
        | same-origin API proxy
frontend (Next.js server)
        | HTTP
backend (Express / TypeScript) ---- PostgreSQL (Sequelize)
        | authenticated internal HTTP
AI client (Ollama + MCP) -------- MCP server (MCP TypeScript SDK)
```

- **frontend** owns the browser experience and proxies same-origin API requests to the backend, preserving the HttpOnly auth cookie.
- **backend** owns authentication, API validation, business services, and PostgreSQL persistence through Sequelize.
- **ai-client** is an independent TypeScript package that hosts Ollama orchestration and its authenticated MCP client.
- **mcp-server** exposes authenticated MCP tools and delegates authorization and business operations to the backend.
- **Zod** is available for validation at external boundaries. Services are independently buildable and should not import one another's source.

## Prerequisites

Node.js 20 or newer and npm. PostgreSQL is needed for backend and MCP integration; Ollama is used for local LLM requests.

## Setup

From the repository root, run `npm install`, then copy each `.env.example` to `.env` in its package and set local values. Do not commit `.env` files.

### Run the complete application (Windows PowerShell)

1. Start PostgreSQL and create the database named by `DATABASE_URL` (the example uses `cinemate`). From the repository root, install packages:

   ```powershell
   npm install
   ```

2. Create local env files from the examples if they do not already exist. Keep existing `.env` files and values; do not overwrite them:

   ```powershell
   if (-not (Test-Path backend/.env)) { Copy-Item backend/.env.example backend/.env }
   if (-not (Test-Path mcp-server/.env)) { Copy-Item mcp-server/.env.example mcp-server/.env }
   if (-not (Test-Path ai-client/.env)) { Copy-Item ai-client/.env.example ai-client/.env }
   if (-not (Test-Path frontend/.env)) { Copy-Item frontend/.env.example frontend/.env }
   ```

   Set `DATABASE_URL` and a random `JWT_SECRET` of at least 32 characters in `backend/.env`. Use the same `JWT_SECRET` in `mcp-server/.env` and `ai-client/.env`. Set the same random value of at least 32 characters for `AI_CLIENT_SERVICE_TOKEN` in `backend/.env` and `ai-client/.env`. Set `MCP_SERVER_URL=http://127.0.0.1:4100/mcp`, `OLLAMA_BASE_URL=http://127.0.0.1:11434` and `OLLAMA_MODEL=llama3.1:8b` in `ai-client/.env`, then run `ollama pull llama3.1:8b`. `frontend/.env` should use `BACKEND_BASE_URL=http://127.0.0.1:4000`. These are server-side values; do not rename them to `NEXT_PUBLIC_*`.

3. Create/update the schema and load the sample catalog and demo account:

   ```powershell
   npm run db:migrate --workspace=@cinemate/backend
   npm run db:seed --workspace=@cinemate/backend
   npm run build
   ```

4. Start these services in four separate PowerShell terminals, from the repository root:

   ```powershell
   npm run start --workspace=@cinemate/backend
   ```

   ```powershell
   npm run start --workspace=@cinemate/mcp-server
   ```

   ```powershell
   npm run start:server --workspace=@cinemate/ai-client
   ```

   ```powershell
   npm run dev --workspace=@cinemate/frontend
   ```

   Open `http://localhost:3000`. The backend listens on port 4000, MCP on 4100, and the internal AI service on 4200. Start the backend first, then MCP, AI, and frontend. The browser talks only to the frontend; the AI service credentials stay server-side.

The seed demo account is `alex@example.com` with password `DemoPass123!`. New registrations are signed in automatically. After sign-in, the header shows the account name; it refreshes after login, registration, and logout. The profile API returns only the user's ID, name, and email.

Useful root commands:

- `npm run build` builds all workspaces that define a build script.
- `npm run lint` lints all workspaces.
- `npm run format` formats the repository; `npm run format:check` checks formatting.
- `npm run dev --workspace=@cinemate/frontend` starts the frontend.

## Structure

```text
backend/       Express API, PostgreSQL/Sequelize boundary
mcp-server/    MCP protocol server
ai-client/     Ollama agent runtime and MCP client integration boundary
frontend/      Next.js TypeScript application
```

See [AGENTS.md](./AGENTS.md) for coding standards and project rules.

## Backend API (Phase 2)

The backend uses Express controllers for HTTP handling, services for data access and orchestration, Sequelize models for PostgreSQL, Zod for input validation, and a centralized JSON error handler. Movie listing and detail reads are public. Booking and payment reads require authentication and are scoped to the verified token subject. Passwords are hashed with bcrypt (cost 12); password hashes and provider payment references are not returned by API responses.

### Demo booking flow

Signed-in users can choose a future showtime and up to eight available seats on a movie page. `POST /api/bookings/` uses the verified JWT subject as `user_id`, then creates the booking, its `booking_seats`, and a successful `demo-no-charge` payment in one database transaction. The demo never requests card or payment credentials. The confirmation page loads the saved booking and payment state. Booking lists and the authenticated MCP tools read the same user-scoped records, so chat can answer questions about the booking, selected seats, movie/showtime, and payment status. A unique database index on `(show_id, seat_number)` and a show row lock prevent seats from being sold twice.

### Authentication flow

1. `POST /api/auth/register` validates name, email, and password, normalizes the email, stores only a bcrypt password hash, and returns the public user fields.
2. `POST /api/auth/login` compares the submitted password with the stored hash and issues an HS256 JWT with a 15-minute expiry, issuer, audience, and the user's ID in `sub`.
3. The JWT is set as an `HttpOnly`, `SameSite=Strict`, `/api` cookie. The `Secure` flag is enabled in production. The JSON login response contains only public user fields. Non-browser clients may also send the same JWT in an `Authorization: Bearer` header.
4. Authentication middleware verifies the signature, algorithm, issuer, audience, and expiry. Booking and payment authorization middleware requires that verified principal; services use its `sub`-derived user ID in every ownership query. Request `userId` values are ignored.
5. A user can list only their own bookings and payments. Fetching another user's booking returns 404, avoiding disclosure that the booking exists. Payment responses omit provider references.

Because browser authentication uses cookies, any future state-changing private endpoints must also add CSRF/origin protection. Current private booking and payment endpoints are read-only.

Configure `backend/.env` from `backend/.env.example`, create the PostgreSQL database named in `DATABASE_URL`, then run:

```sh
npm install
npm run db:migrate --workspace=@cinemate/backend
npm run db:seed --workspace=@cinemate/backend
npm run build --workspace=@cinemate/backend
npm run start --workspace=@cinemate/backend
```

The seed includes five sample movies and a cinema with upcoming shows. A second seeder creates the chat demo user `d5a70736-edca-4913-9ba9-d573dfb3477d` (`jordan.lee@example.test` / `DemoPass123!`) with confirmed and pending bookings, linked seats, and payment records. These are local demo credentials only.

Run the automated API integration tests against a separate PostgreSQL database when available. They create missing tables without dropping existing ones, use unique test users, and clean up their test records. `TEST_DATABASE_URL` overrides `DATABASE_URL` for the test process:

```powershell
$env:NODE_ENV='test'
$env:TEST_DATABASE_URL='postgres://postgres:password@localhost:5432/cinemate_test'
npm run test --workspace=@cinemate/backend
```

If `TEST_DATABASE_URL` is omitted, tests use `DATABASE_URL` loaded from `backend/.env`.

### Sample requests and responses

Register:

```http
POST /api/auth/register
Content-Type: application/json

{"name":"Jamie Lee","email":"jamie@example.com","password":"A-long-password-123"}
```

```json
{"data":{"id":"a UUID","name":"Jamie Lee","email":"jamie@example.com"}}
```

Login:

```http
POST /api/auth/login
Content-Type: application/json

{"email":"jamie@example.com","password":"A-long-password-123"}
```

```json
{"data":{"user":{"id":"a UUID","name":"Jamie Lee","email":"jamie@example.com"}}}
```

The response also sets `cinemate_token` as an HTTP-only cookie. Browsers send it automatically to `/api` on same-site requests.

List movies (optional pagination and title search):

```http
GET /api/movies/?page=1&limit=20&search=dune
```

```json
{"data":[{"id":"a UUID","title":"Dune: Part Two","genre":"Science Fiction","language":"English","rating":"8.5"}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}
```

Get a movie: `GET /api/movies/{movieId}` returns `{"data":{"id":"a UUID","title":"Dune: Part Two","shows":[]}}`; unknown IDs return HTTP 404.

List the signed-in user's bookings:

```http
GET /api/bookings/
Cookie: cinemate_token=<JWT>
```

```json
{"data":[{"id":"a UUID","status":"confirmed","totalAmount":"29.00","seats":[{"seatNumber":"A10"},{"seatNumber":"A11"}]}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}
```

`GET /api/bookings/{bookingId}` returns one of the signed-in user's bookings or 404. `GET /api/payments/` returns that user's payment records. Both require the authentication cookie or bearer token. Validation errors use HTTP 400 with `{"error":{"message":"..."}}`; missing, invalid, or expired credentials use HTTP 401.

## MCP server (Phase 4)

The MCP server is an independent Streamable HTTP service. It calls the backend HTTP API with the authenticated user's original JWT; it does not access PostgreSQL or import backend models. This keeps ownership checks in backend services. Each MCP session is bound to the verified JWT subject, rejects use by another user, expires from memory after 30 minutes idle, and requires a still-valid JWT on every request.

Copy `mcp-server/.env.example` to `mcp-server/.env`. Set `BACKEND_BASE_URL` to the Express API origin and `JWT_SECRET` to the same random secret configured in `backend/.env`. Keep the MCP server on localhost for local development; use HTTPS and a protected network when exposing it remotely.

```sh
npm install
npm run build --workspace=@cinemate/backend
npm run build --workspace=@cinemate/mcp-server
npm run start --workspace=@cinemate/backend
# In another terminal:
npm run start --workspace=@cinemate/mcp-server
```

The MCP endpoint is `http://127.0.0.1:4100/mcp` by default. Send the backend JWT with `Authorization: Bearer <JWT>`; the `cinemate_token` cookie from login is also accepted using a `Cookie` header. Initialize a Streamable HTTP session, then pass the returned `Mcp-Session-Id` on subsequent requests. Sessions cannot be reused with a different user's JWT.

### MCP tool schemas

All schemas are strict and reject extra fields, including `userId`. User identity always comes from the verified JWT.

| Tool | Input | Behavior |
| --- | --- | --- |
| `search_movies` | `{ title?: string, genre?: string, language?: string }` (at least one filter) | Searches title, genre, and language. |
| `get_movie_details` | `{ movie_id: UUID }` | Returns movie details, shows, and cinema information. |
| `get_my_profile` | `{}` | Returns the authenticated user's public name and email. |
| `get_my_bookings` | `{ status?: "pending" | "confirmed" | "cancelled" | "active" }` | Lists only the authenticated user's bookings; `active` maps to `confirmed`. |
| `get_booking_details` | `{ booking_id: UUID }` | Returns a booking only when the JWT owner matches. |
| `get_payment_status` | `{ booking_id: UUID }` | Returns safe status/amount/currency data only for the owner's booking. |

Run MCP integration tests with `npm run test --workspace=@cinemate/mcp-server`. The tests build the backend, create two users, call all six tools over Streamable HTTP, and verify cross-user access is denied.

## Custom MCP client (Phase 5)

`ai-client` is an independent TypeScript client built on the official MCP SDK. It connects to the Streamable HTTP endpoint with a bearer JWT, and the SDK manages the returned `Mcp-Session-Id` for subsequent `listTools()` and `callTool()` requests. `close()` ends the transport session. Connection failures raise `McpConnectionError`; MCP tool failures raise `McpToolExecutionError` with the tool name and safe server message.

Copy `ai-client/.env.example` to `ai-client/.env`. Set `MCP_SERVER_URL` to the MCP endpoint and `MCP_AUTH_TOKEN` to the JWT value from the backend login `Set-Cookie` response (`cinemate_token`). Keep the token out of source control.

```ts
import { McpClient } from '@cinemate/ai-client';

const client = new McpClient({
  serverUrl: process.env.MCP_SERVER_URL!,
  accessToken: process.env.MCP_AUTH_TOKEN!,
});

try {
  await client.connect();
  const { tools } = await client.listTools();
  console.log(tools.map((tool) => tool.name));

  const result = await client.callTool('search_movies', { genre: 'Drama' });
  console.log(result.content);
} finally {
  await client.close();
}
```

Run AI client integration tests with `npm run test --workspace=@cinemate/ai-client`. They launch local backend/MCP test servers, discover the six tools, execute movie search and booking listing, and verify invalid authentication and cross-user tool access are rejected. The LLM provider was added in Phase 6 below.

## Ollama provider

The Ollama provider runs in the server-side `ai-client` workspace and calls Ollama local chat API. Set `OLLAMA_BASE_URL` and `OLLAMA_MODEL` in `ai-client/.env`; defaults are `http://127.0.0.1:11434` and `llama3.1:8b`.

```env
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.1:8b
```

The function-calling turn discovers tools from the authenticated `McpClient` at request time, carries their names, descriptions, and JSON input schemas into Ollama, validates model arguments locally, and executes only a discovered tool through that same authenticated MCP session. `userId`-style schema fields are rejected. MCP output is sent back as an Ollama tool response, and the model is asked for one final response with additional function calling disabled. For persistent history and repeated tool-call rounds, use the Phase 7 agent runtime below.

```ts
import { OllamaProvider, McpClient, runFunctionCallingTurn } from '@cinemate/ai-client';

const mcp = new McpClient({
  serverUrl: process.env.MCP_SERVER_URL!,
  accessToken: process.env.MCP_AUTH_TOKEN!,
});

await mcp.connect();
try {
  const turn = await runFunctionCallingTurn(new OllamaProvider(), mcp, 'Find Avatar.');
  console.log(turn.text);
} finally {
  await mcp.close();
}
```

`OllamaProviderError` reports Ollama connection and server failures. Tool schema, argument, unknown-tool, MCP, and invalid-result failures are returned as tool errors or raised as typed client errors. Run TypeScript checks and tests with:

```sh
npm run build --workspace=@cinemate/ai-client
npm run lint --workspace=@cinemate/ai-client
npm run test --workspace=@cinemate/ai-client
```

Ensure Ollama is running and the configured model has been pulled before sending live requests.

## Agent runtime (Phase 7)

`AgentRuntime` builds on the existing provider and MCP client. It keeps conversation history across messages, rediscovers tools on every tool-call round, validates arguments against the discovered MCP JSON schemas, and executes calls sequentially through the injected authenticated client. Each runtime must be created for one authenticated MCP client and must not be shared between users. The runtime takes no `userId`; MCP verifies the JWT and backend ownership checks remain authoritative.

The default limit is five Ollama/tool rounds per message (configurable from 1 through 12). At the limit, the runtime disables further function calling and asks Ollama to summarize the available results. Tool errors are returned as tool responses so it can explain a failure. Use `getConversationHistory()` to inspect a copy of the history or `clearConversation()` to start a fresh conversation.

```ts
import { AgentRuntime, OllamaProvider, McpClient } from '@cinemate/ai-client';

const mcp = new McpClient({
  serverUrl: process.env.MCP_SERVER_URL!,
  accessToken: process.env.MCP_AUTH_TOKEN!,
});
await mcp.connect();

const agent = new AgentRuntime(new OllamaProvider(), mcp, { maxIterations: 5 });
try {
  const first = await agent.sendMessage('Show my bookings.');
  console.log(first.text);
  const followUp = await agent.sendMessage('Search for Avatar.');
  console.log(followUp.text);
} finally {
  await mcp.close();
}
```

No agent-specific automated tests were added per the Phase 7 instruction. Run the existing compile and lint checks with `npm run build --workspace=@cinemate/ai-client` and `npm run lint --workspace=@cinemate/ai-client`.

## Next.js frontend (Phase 8)

The responsive dark cinema UI includes movie search and details, registration/login, private bookings, and an AI chat with Markdown, loading/tool status, and local browser history. Tailwind CSS 4 is configured with PostCSS. Authenticated routes are gated by the HttpOnly cookie; all private APIs still verify the JWT in the backend. The frontend never receives JWT contents or any Ollama/MCP secret. Login sets the cookie on the same-origin `/api` proxy; logout clears it.

The browser sends chat to `POST /api/ai/chat` with only a conversation ID and message. The backend authenticates the cookie and passes its verified `req.user.id` and verified JWT to the private AI client endpoint, protected by `AI_CLIENT_SERVICE_TOKEN`. The AI service independently verifies that JWT and checks the claimed ID matches its `sub`, then scopes a process-local agent/MCP session to that user and conversation ID. The MCP server and backend continue to enforce ownership. Chat messages are saved in browser local storage; active Ollama conversation context is held in AI service memory for up to 30 idle minutes and is cleared when the AI service restarts.

Set these server-side values in the package `.env` files (use long random values and keep `.env` files untracked):

- `frontend/.env`: `BACKEND_BASE_URL=http://127.0.0.1:4000` (not a `NEXT_PUBLIC_*` variable).
- `backend/.env`: `AI_CLIENT_BASE_URL=http://127.0.0.1:4200` and `AI_CLIENT_SERVICE_TOKEN`.
- `ai-client/.env`: the same `AI_CLIENT_SERVICE_TOKEN`, backend's `JWT_SECRET`, `MCP_SERVER_URL`, `OLLAMA_BASE_URL`, and `OLLAMA_MODEL`. The AI service binds to `127.0.0.1:4200` by default.

Start the backend and MCP server as described above, then start the AI client service and frontend in separate terminals:

```sh
npm run build --workspace=@cinemate/ai-client
npm run start:server --workspace=@cinemate/ai-client
npm run dev --workspace=@cinemate/frontend
```

The AI service provides `GET /health` and its chat endpoint is internal; the browser only calls the Next.js `/api` proxy. Run `npm run build --workspace=@cinemate/frontend` and `npm run lint --workspace=@cinemate/frontend` to check the UI.

## End-to-end verification (Phase 9)

The end-to-end suite uses the configured PostgreSQL database and launches the built backend, MCP server, and AI chat service on ephemeral local ports. Ollama is replaced with a deterministic function-call fixture so the checks do not require a live provider key; MCP, backend APIs, authorization, Sequelize queries, and tool responses are real. The suite covers two-user registration/login, separate booking lists, movie search and details, booking and payment retrieval, follow-up context, sequential multiple tool calls, cross-user denial, unauthenticated and forged-identity requests, MCP outage handling, and Ollama outage messaging.

Use a dedicated test database (`TEST_DATABASE_URL`) before running this command. The suite inserts unique fixtures and removes them after execution:

```powershell
$env:NODE_ENV='test'
$env:TEST_DATABASE_URL='postgres://postgres:password@localhost:5432/cinemate_test'
npm run test:e2e --workspace=@cinemate/ai-client
```

This project uses Ollama. The outage check therefore exercises Ollama provider failure and unavailable MCP tools rather than an Ollama server. The existing backend and MCP test suites can also be run with `npm run test --workspace=@cinemate/backend` and `npm run test --workspace=@cinemate/mcp-server`.
# Docker deployment

Docker files are provided for the backend, MCP server, AI client, and Next.js frontend. PostgreSQL uses a named persistent volume. The AI client uses Ollama on the internal Compose network. Only the frontend is published to the host; PostgreSQL, Ollama, backend, and MCP ports stay inside the Compose network.

## Start locally

1. Copy `.env.docker.example` to `.env.docker` and replace the placeholder passwords, JWT secret, and service token. Set `OLLAMA_MODEL` if you want a model other than `llama3.1:8b`. Compose pulls the configured model into the persistent Ollama volume before starting the AI client.
2. Docker Compose reads the shared container settings from `.env.docker`; the service `.env` files are for running each service directly on the host. The Compose file supplies the internal URLs and binds the MCP and AI servers to the container network.
3. Always pass the Docker env file because Compose does not load `.env.docker` automatically: `docker compose --env-file .env.docker config`, then `docker compose --env-file .env.docker up --build -d`. The backend waits for healthy Postgres, applies pending migrations and seed data, then starts the API. The demo seeder skips its data when `alex@example.com` already exists, so container restarts do not duplicate the catalog.
4. Inspect status and logs: `docker compose ps` and `docker compose logs -f backend ai-client mcp-server frontend`.
5. Open `http://localhost:3000`.

Stop services with `docker compose down`. Data volumes remain. Remove volumes only when intentionally deleting local database/model data: `docker compose down -v`.

Check the application-specific health routes, package start scripts, and environment variable names against the existing services before deploying. Compose health checks assume `/health` on backend (4000), MCP (4100), and AI client (4200). The database and internal service ports are not published to the host. Review `docker compose config` before startup and never use placeholder credentials outside local development.

