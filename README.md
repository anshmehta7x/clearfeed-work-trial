# Support Ticket Assignment

Local-only Clearfeed work trial: a team-lead dashboard for agent availability and an API that assigns tickets using timezone-aware availability, ticket density (`active tickets ÷ scheduled weekly hours`), and explainable fallbacks.

## Stack

| Layer | Choice |
| --- | --- |
| UI | React 19 + TypeScript + Vite + Tailwind CSS v4 |
| API | Express + TypeScript |
| Database | PostgreSQL |

Docs: [`docs/prd.md`](docs/prd.md), [`docs/implementation.md`](docs/implementation.md), [`docs/work-trial.md`](docs/work-trial.md).

## Prerequisites

- Node.js 24+
- npm
- Docker + Docker Compose *(recommended)*, **or** a local PostgreSQL 18 instance

## Environment

```bash
cp .env.example .env
```

Required variables:

| Variable | Purpose |
| --- | --- |
| `POSTGRES_USER` | DB user |
| `POSTGRES_PASSWORD` | DB password |
| `POSTGRES_DB` | Database name |
| `POSTGRES_HOST` | Host (`localhost` locally, `db` in Compose) |
| `POSTGRES_PORT` | Port (default `5432`) |

The API reads these from the process environment (no dotenv). When running npm scripts outside Docker, load `.env` first:

```bash
set -a && source .env && set +a
```

## Quick start (Docker)

```bash
cp .env.example .env
docker compose up --build -d
```

Compose starts Postgres, migrates the API schema, and serves:

| Service | URL |
| --- | --- |
| UI | http://localhost:5173 |
| API | http://localhost:3000 |

Seed the demo company after the first boot (Compose migrates but does not seed). From the host, with `.env` loaded and Postgres on `localhost:5432`:

```bash
set -a && source .env && set +a
cd api && npm ci && npm run db:seed
```

## Tests

```bash
# API unit / route tests
cd api && npm test

# API PostgreSQL integration tests (needs DB + env loaded)
set -a && source ../.env && set +a
cd api && npm run test:integration

# UI unit + SPA flow tests
cd ui && npm test
```

## What I'd build next

- Persist cross-process assignment locking with DB row locks for multi-instance deploys
- Company picker and multi-company UI (API already scopes by `companyId`)
- Support for Ticket Severity and resolver groups, that allow ticket routing based on severity and resolver group membership
- Integrations with external ticketing systems (e.g. Jira, Zendesk)
- Integrations with systems like PagerDuty to trigger alerts and escalate tickets
- Specialised AI agents as a fallback layer, that routes tickets to AI agents for resolution when no human agent is available/eligible

## Screenshots

![image1](https://imgh.in/host/pc4h8c)
![image2](https://imgh.in/host/b22asx)

## Demo

[![Demo walkthrough](https://img.youtube.com/vi/nj4Fi9RiMEE/maxresdefault.jpg)](https://youtu.be/nj4Fi9RiMEE)
