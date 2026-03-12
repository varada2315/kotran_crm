# Growitate CRM Platform

## Overview

A full-stack SaaS CRM web application with dual-workspace support. Built with React + Vite frontend and Express backend, using PostgreSQL for data persistence.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **Frontend**: React + Vite + TailwindCSS + ShadCN UI
- **Backend**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Auth**: JWT (jsonwebtoken + bcryptjs)
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Charts**: Recharts
- **Forms**: react-hook-form + @hookform/resolvers
- **Animations**: framer-motion

## Architecture

### Auth Flow
1. Login/Register → JWT token stored in `localStorage` as `growitate_token`
2. After login → Workspace Selector (two workspaces: Growitate CRM + DeploidX CRM)
3. Selected workspace ID stored in `localStorage` as `growitate_workspace_id`
4. All API calls scoped to `/api/workspaces/{workspaceId}/...`

### Workspaces (seeded)
| ID | Name | Slug | Description |
|----|------|------|-------------|
| 1  | Growitate CRM | growitate | Marketing & Lead Management |
| 2  | DeploidX CRM | deploidx | DevOps & Hosting Clients |

## Structure

```text
artifacts/
├── api-server/         # Express API server
│   └── src/
│       ├── middleware/auth.ts   # JWT auth middleware
│       └── routes/
│           ├── auth.ts          # POST /api/auth/login, register, GET /me
│           ├── workspaces.ts    # GET /api/workspaces
│           ├── clients.ts       # CRUD /api/workspaces/:id/clients
│           ├── activities.ts    # Activity logging
│           └── analytics.ts    # Analytics aggregations
└── growitate-crm/      # React + Vite frontend
    └── src/
        ├── contexts/            # Auth + Workspace React contexts
        ├── pages/               # Login, Register, Workspaces, Clients, Activities, Analytics
        └── components/
            └── layout/          # DashboardLayout with top navbar

lib/
├── api-spec/openapi.yaml        # OpenAPI 3.1 contract
├── api-client-react/            # Generated React Query hooks
├── api-zod/                     # Generated Zod schemas
└── db/src/schema/               # Drizzle ORM tables (users, workspaces, clients, activities)
```

## Database Tables

- `users` — id, name, email, password, created_at
- `workspaces` — id, name, slug, description
- `clients` — id, workspace_id, client_name, display_name, phone, whatsapp, email, notes, lead_stage, opportunity_size, groups, created_at, last_activity_at
- `activities` — id, client_id, workspace_id, type, description, date

## Lead Stages
`new` → `contacted` → `qualified` → `proposal` → `negotiation` → `won` / `lost`

## Activity Types
`client_added`, `call`, `meeting`, `note`, `follow_up`, `task`

## CRM Pages
- `/login` — Login form
- `/register` — Registration form
- `/workspaces` — Workspace selector
- `/clients` — Client list with search, tabs, filters
- `/clients/:id` — Client detail with activities timeline
- `/activities` — Workspace activity log
- `/analytics` — Charts: clients by stage, activities by type, monthly trends

## Key Commands

```bash
# Start API server
pnpm --filter @workspace/api-server run dev

# Start frontend
pnpm --filter @workspace/growitate-crm run dev

# Push DB schema changes
pnpm --filter @workspace/db run push

# Regenerate API client from OpenAPI spec
pnpm --filter @workspace/api-spec run codegen
```

## Environment Variables
- `DATABASE_URL` — PostgreSQL connection string (auto-provisioned by Replit)
- `JWT_SECRET` — Optional; defaults to a built-in key (set this in production)
- `PORT` — Auto-assigned per service
