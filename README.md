# CineMate AI

An AI-powered movie booking assistant monorepo. Phase 1 establishes the independent application boundaries and shared developer tooling; it intentionally contains no booking business logic.

## Architecture

```text
frontend (Next.js / React)
        | HTTP
backend (Express / TypeScript) ---- PostgreSQL (Sequelize)
        |                               
        +---- AI client (Ollama) ---- MCP server (MCP TypeScript SDK)
```

- **frontend** owns the browser experience and calls the backend over HTTP.
- **backend** is the API boundary and will own persistence through PostgreSQL and Sequelize.
- **ai-client** is an independent TypeScript package responsible for Ollama interaction and coordinating MCP capabilities.
- **mcp-server** is an independent MCP server that will expose explicitly defined tools and resources.
- **Zod** is available for validation at external boundaries. Services are independently buildable and should not import one another's source.

## Prerequisites

Node.js 20 or newer and npm. PostgreSQL and Ollama are only needed when their integrations are implemented.

## Setup

From the repository root, run `npm install`, then copy each `.env.example` to `.env` in its package and set local values. Do not commit `.env` files.

Useful root commands:

- `npm run build` builds all workspaces that define a build script.
- `npm run lint` lints all workspaces.
- `npm run format` formats the repository; `npm run format:check` checks formatting.
- `npm run dev --workspace=@cinemate/frontend` starts the frontend.

## Structure

```text
backend/       Express API, PostgreSQL/Sequelize boundary
mcp-server/    MCP protocol server
ai-client/     Ollama and MCP client integration boundary
frontend/      Next.js TypeScript application
```

See [AGENTS.md](./AGENTS.md) for coding standards and project rules.

## Backend API (Phase 2)

The backend uses Express controllers for HTTP handling, services for data access and orchestration, Sequelize models for PostgreSQL, Zod for input validation, and a centralized JSON error handler. Booking and payment reads require a bearer token and are scoped to that token's user. Movie listing and detail reads are public. Passwords are stored as bcrypt hashes; authentication returns a signed JWT.

Configure `backend/.env` from `backend/.env.example`, create the PostgreSQL database named in `DATABASE_URL`, then run:

```sh
npm install
npm run db:migrate --workspace=@cinemate/backend
npm run db:seed --workspace=@cinemate/backend
npm run build --workspace=@cinemate/backend
npm run start --workspace=@cinemate/backend
```

The seed includes five sample movies, a cinema with upcoming shows, and a demo account with a confirmed two-seat booking and successful demo payment. Demo login: `alex@example.com` / `DemoPass123!`. Change or remove this sample account outside local development.

Run the automated API integration tests against a separate disposable PostgreSQL database. The tests use `sequelize.sync({ force: true })` on that database:

```powershell
$env:NODE_ENV='test'
$env:TEST_DATABASE_URL='postgres://postgres:password@localhost:5432/cinemate_test'
npm run test --workspace=@cinemate/backend
```

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
{"data":{"token":"a signed JWT","user":{"id":"a UUID","name":"Jamie Lee","email":"jamie@example.com"}}}
```

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
Authorization: Bearer <token>
```

```json
{"data":[{"id":"a UUID","status":"confirmed","totalAmount":"29.00","seats":[{"seatNumber":"A10"},{"seatNumber":"A11"}]}],"pagination":{"page":1,"limit":20,"total":1,"pages":1}}
```

`GET /api/bookings/{bookingId}` returns one of the signed-in user's bookings or 404. `GET /api/payments/` returns that user's payment records. Both require the same bearer header. Validation errors use HTTP 400 with `{"error":{"message":"..."}}`; unauthenticated requests use HTTP 401.
