# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Artifacts

### inventory-dashboard (React + Vite, preview path: `/`)
Inventory reorder dashboard. Uses Supabase for auth and product storage.

**Features:**
- Product CRUD with inline editing
- CSV import/export
- Status calculation (High Risk / Medium Risk / Healthy)
- Days-left progress bars, search, filter, sort
- AI analysis via OpenAI GPT-4o-mini (`/api/analyze`)
- Email alerts via Resend (`/api/alert`)
- Profit impact analysis via OpenAI (`/api/profit`)

**Environment variables needed:**
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon key
- `OPENAI_API_KEY` — OpenAI key for AI analysis (server-side)
- `RESEND_API_KEY` — Resend key for email alerts (server-side)

**Resend note:** The Resend integration was set up manually via API key secret (user dismissed the OAuth connector flow). With a free Resend account, emails can only be sent to the verified owner email. To send to any recipient, verify a domain at resend.com/domains and update the `from` address in `artifacts/api-server/src/routes/alert.ts`.

### api-server (Express 5, preview path: `/api`)
Shared backend. Routes:
- `GET /api/healthz` — health check
- `POST /api/analyze` — OpenAI per-product inventory analysis
- `POST /api/alert` — Resend email alert
- `POST /api/profit` — OpenAI profit impact analysis (revenue at risk, holding costs, reorder ROI)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.
