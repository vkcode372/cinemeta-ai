# Project rules

- Use TypeScript for all application code. Keep JavaScript limited to tool configuration where a tool requires it.
- Keep `backend`, `mcp-server`, `ai-client`, and `frontend` independently buildable and deployable; communicate through documented interfaces, not workspace imports.
- Use modular boundaries (routes/controllers/services/repositories in the backend; transport and protocol modules in the MCP server; provider and orchestration modules in the AI client; route and component modules in the frontend).
- Validate untrusted input at system boundaries with Zod. Keep secrets in environment variables; commit only `.env.example` files with placeholders.
- Do not add booking or other business behavior until a feature explicitly calls for it.
- Prefer existing dependencies and standard library APIs. Add a dependency only when needed and document its purpose.
- Use strict TypeScript, ESLint, and Prettier. Keep functions focused and avoid `any`.
- Never commit credentials, generated output, `node_modules`, or local environment files.
- Update relevant README or environment examples when configuration or architecture changes.
