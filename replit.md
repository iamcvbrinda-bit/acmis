# ACIMS — Adaptive Campus Mobility Intelligence System

ACIMS helps college commuters see where their bus is, understand capacity, receive useful route alerts, and join an overflow queue when a ride is full.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Frontend: React + Vite, Tailwind CSS, Wouter, React Query
- API: Express 5
- Data layer: in-memory demo services, ready for a persistent store later
- Maps: Leaflet + OpenStreetMap
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/acims/src/` — responsive ACIMS student experience and pages
- `artifacts/api-server/src/services/` — bus simulation, queue management, and alert generation
- `artifacts/api-server/src/routes/` — Express route handlers
- `lib/api-spec/openapi.yaml` — source of truth for the API contract
- `lib/api-client-react/src/generated/` — generated React Query client hooks
- `artifacts/acims/src/index.css` — ACIMS visual tokens and motion

## Architecture decisions

- Demo state is intentionally held in server-side services so the core flow works without a paid service or database setup.
- Bus location simulation is isolated behind the same location update boundary used for future driver-device GPS ingestion.
- Queue state is keyed by student, bus, and boarding stop and rejects duplicate active entries.
- Smart alerts are generated from bus movement and queue state instead of being hard-coded into the page UI.

## Product

- Dashboard for the selected Bus 12 route with live ETA, next stop, capacity, and queue outlook
- Leaflet/OpenStreetMap live route view with simulated bus coordinates and stop markers
- Boarding stop selection and persistent-in-session overflow queue with leave/rejoin behavior
- Alert inbox with unread counts and mark-as-read actions
- Development occupancy controls for demonstrating seats opening and queue eligibility

## User preferences

No additional preferences recorded.

## Gotchas

- Run `pnpm --filter @workspace/api-spec run codegen` after changing `lib/api-spec/openapi.yaml`.
- The live map uses public OpenStreetMap tiles and must retain the visible attribution.
- The demo data is in-memory and resets when the API workflow restarts.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
