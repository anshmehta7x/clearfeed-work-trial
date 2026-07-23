# Technical Design Document: Support Ticket Assignment

## 1. Overview

This document describes the technical design for the Support Ticket Assignment service defined in `prd.md`: a UI for managing agent availability and an API that assigns incoming tickets to the right agent automatically.

### Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| **Frontend** | React + Vite | The product is a single page (dashboard, agents, tickets, and an availability modal) with no routing or multi-page navigation, so a lightweight SPA setup fits better than a complete framework built around routing and server rendering like Next.js. |
| **Backend** | Express | The API surface is small (assignment, agents, availability, tickets) and needs only straightforward REST endpoints with business logic in between.
| **Database** | PostgreSQL | Data is relational with constraints worth enforcing at the DB level (uniqueness, foreign keys) and timestamp-based ordering (least-recently-assigned tie-break), which a relational store handles cleanly. |

## 2. Data Model

### 2.1 Entities & Fields

| Entity | Fields |
| --- | --- |
| **Company** | `id`, `name` |
| **Agent** | `id`, `company_id`, `name`, `utc_offset_minutes`, `last_assigned_at` |
| **AvailabilityWindow** | `id`, `agent_id`, `start_minute_utc` (minute within the UTC week, `0..10079`, Sunday 00:00 = `0`), `duration_minutes` |
| **Ticket** | `id`, `company_id`, `status`, `assigned_agent_id`, `assigned_at`, `reason`, `closed_at` |

### 2.2 Schema

```sql
CREATE TABLE company (
    id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name    TEXT NOT NULL
);

CREATE TABLE agent (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES company(id),
    name                TEXT NOT NULL,
    utc_offset_minutes  INTEGER NOT NULL CHECK (utc_offset_minutes BETWEEN -720 AND 840),
    last_assigned_at    TIMESTAMPTZ,
    UNIQUE (company_id, id)
);

CREATE TABLE availability_window (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agent_id            UUID NOT NULL REFERENCES agent(id) ON DELETE CASCADE,
    start_minute_utc    SMALLINT NOT NULL CHECK (start_minute_utc BETWEEN 0 AND 10079),
    duration_minutes    SMALLINT NOT NULL CHECK (duration_minutes BETWEEN 1 AND 1440)
);

CREATE TABLE ticket (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id          UUID NOT NULL REFERENCES company(id),
    status              TEXT NOT NULL CHECK (status IN ('unassigned', 'assigned', 'closed')) DEFAULT 'unassigned',
    assigned_agent_id   UUID,
    assigned_at         TIMESTAMPTZ,
    reason              TEXT,
    closed_at           TIMESTAMPTZ,
    FOREIGN KEY (company_id, assigned_agent_id) REFERENCES agent(company_id, id),
    CHECK (
        (status = 'unassigned' AND assigned_agent_id IS NULL AND reason IS NULL) OR
        (status IN ('assigned', 'closed') AND assigned_agent_id IS NOT NULL
            AND reason IS NOT NULL AND length(trim(reason)) > 0)
    )
);

CREATE INDEX idx_agent_company_id ON agent(company_id);
CREATE INDEX idx_availability_agent_id ON availability_window(agent_id);
CREATE INDEX idx_ticket_company_id ON ticket(company_id);
CREATE INDEX idx_ticket_agent_status ON ticket(assigned_agent_id, status);
```

### 2.3 Key Modeling Decisions

1. **Windows stored UTC-only, no local columns** — single source of truth; local display is derived by reversing the fixed offset.
2. **One row per normalized window** — after same-day local overlaps are merged, each window stores its UTC start minute within the recurring week plus its duration. The weekly timeline is circular, so a window can cross UTC midnight or the Saturday/Sunday boundary without being split into extra rows.
3. **Ticket density computed on read, not stored** — derived from active ticket count ÷ scheduled weekly hours at request time; avoids drift since it changes on every assign/close.
4. **`last_assigned_at` on Agent** — supports the least-recently-assigned tie-break; updated on every successful assignment.
5. **Replace-all-on-save for an agent's windows** — the edit modal submits the full weekly schedule at once, so saving replaces the agent's window set wholesale rather than diffing individual rows (avoids partial-update bugs).

## 3. Timezone & Availability Handling

All arithmetic uses a circular UTC week of `10080` minutes. Windows are half-open intervals: the start is included and the instant at `start + duration` is excluded. DST is out of scope, so each agent has one fixed `utc_offset_minutes`.

### 3.1 Save Pipeline

The request contains local, same-day windows. The server validates them, merges overlapping or adjacent windows within each local day, converts each merged window, then replaces the agent's rows in one transaction.

```
MINUTES_PER_WEEK = 10080
normalize(value) = ((value % MINUTES_PER_WEEK) + MINUTES_PER_WEEK) % MINUTES_PER_WEEK

local_start = day_of_week_local * 1440 + start_minute_local
start_minute_utc = normalize(local_start - utc_offset_minutes)
duration_minutes = end_minute_local - start_minute_local
```

Only the start is converted. Duration is timezone-independent, so UTC midnight needs no special handling.

**Example:** Monday 00:30–02:00 at UTC+1 becomes `start_minute_utc = 1410` (Sunday 23:30 UTC) and `duration_minutes = 90`. It remains one row even though it ends Monday 01:00 UTC.

### 3.2 Availability and Next Window

Convert `now` to its UTC minute within the week. For each window:

```
elapsed = normalize(now_minute_utc - window.start_minute_utc)
is_available = elapsed < window.duration_minutes
```

This same check works across UTC midnight and the weekly boundary. To find the next window, return `now` when currently available; otherwise calculate `normalize(window.start_minute_utc - now_minute_utc)` for every window and choose the smallest delta.

### 3.3 Reading and Display

To edit a stored window, reverse the fixed offset:

```
local_start = normalize(start_minute_utc + utc_offset_minutes)
day_of_week_local = floor(local_start / 1440)
start_minute_local = local_start % 1440
end_minute_local = start_minute_local + duration_minutes
```

Because all writes originate as valid same-day local windows, the reconstructed end remains at or before `1440`. Changing the offset preserves the displayed local schedule and recalculates its UTC start on save.

For the Gantt and 30-minute coverage calculation, the frontend expands circular windows into ordinary display segments in memory. A segment is split only when needed to draw across a day or week boundary; no extra database rows are created.

### 3.4 Scheduled Weekly Hours

Not stored. Computed on read as the sum of `duration_minutes` across the agent's normalized windows, divided by `60`.

## 4. API

### 4.1 `GET /companies/:companyId/agents`

**Purpose:** List all agents for a company with computed workload data.

**UI significance:** Powers the Agents section (cards) and the Coverage Gantt chart (raw windows).

**Response `200`:**

```json
{
  "agents": [
    {
      "id": "uuid",
      "name": "string",
      "utcOffsetMinutes": 330,
      "scheduledWeeklyHours": 40,
      "activeTicketCount": 3,
      "ticketDensity": 0.075,
      "lastAssignedAt": "2026-07-20T10:00:00Z",
      "availabilityWindows": [
        { "startMinuteUtc": 1650, "durationMinutes": 480 }
      ]
    }
  ]
}
```

`availabilityWindows` matches the circular UTC-week representation used internally (§2.2, §3). The frontend converts it to browser time only for rendering the Gantt chart.

**Errors:**

- `400` — `companyId` is not a well-formed UUID
- `404` — company not found

### 4.2 `PUT /companies/:companyId/agents/:agentId/availability`

**Purpose:** Replace an agent's full weekly schedule (local windows in, merged locally and converted to circular UTC windows server-side).

**UI significance:** Edit Availability modal save action.

**Request:**

```json
{
  "utcOffsetMinutes": 330,
  "windows": [
    { "dayOfWeek": 1, "startMinute": 540, "endMinute": 1020 }
  ]
}
```

`windows: []` is valid — it sets the agent to zero scheduled weekly hours and is not a `400`.

**Response `200`:** updated agent object.

**Errors:**

- `400` — `companyId` or `agentId` is not a well-formed UUID, or invalid window (e.g. `startMinute >= endMinute`, out-of-range values (`startMinute` not in `0..1439`, `endMinute` not in `1..1440`), out-of-range `dayOfWeek`, malformed offset)
- `404` — company or agent not found (or agent doesn't belong to company)

### 4.3 `GET /companies/:companyId/tickets`

**Purpose:** List all tickets for a company.

**UI significance:** Tickets table + stats bar counts.

**Response `200`:**

```json
{
  "tickets": [
    {
      "id": "uuid",
      "status": "assigned",
      "assignedAgentId": "uuid",
      "assignedAt": "2026-07-20T10:00:00Z",
      "reason": "string",
      "closedAt": null
    }
  ]
}
```

**Errors:**

- `400` — `companyId` is not a well-formed UUID
- `404` — company not found

### 4.4 `POST /companies/:companyId/tickets/:ticketId/assign`

**Purpose:** Assign a ticket to an agent using the assignment algorithm. Idempotent if the ticket is already assigned or closed.

**UI significance:** Tickets table **Assign** button.

**Response `200`:**

```json
{
  "ticketId": "uuid",
  "assignedAgentId": "uuid",
  "assignedAt": "2026-07-20T10:00:00Z",
  "status": "assigned",
  "reason": "string"
}
```

If the ticket is already assigned or closed: same `200` shape, keeping the API idempotent. `201` is not used here since the ticket is assigned, not created.

**Errors:**

- `400` — `companyId` or `ticketId` is not a well-formed UUID
- `404` — company or ticket not found (or ticket doesn't belong to company)
- `422` — company has no agents configured (cannot assign) // PRD assumes there is at least one agent, adding this error code defensively

### 4.5 `POST /companies/:companyId/tickets/:ticketId/close`

**Purpose:** Close an assigned ticket so it leaves the agent's active workload.

**UI significance:** Tickets table **Close** button.

**Response `200`:**

```json
{
  "ticketId": "uuid",
  "status": "closed",
  "closedAt": "2026-07-20T12:00:00Z"
}
```

If already closed: same shape, returning the existing `closedAt`, keeping the API idempotent.

**Errors:**

- `400` — `companyId` or `ticketId` is not a well-formed UUID
- `404` — company or ticket not found
- `409` — ticket is unassigned (closing tickets requires prior assignment)

## 5. Assignment Algorithm Pseudocode

```
MAX_DENSITY_THRESHOLD = 0.25

FUNCTION assignTicket(companyId, ticketId):

    company = getCompany(companyId)
    IF company NOT FOUND:
        RETURN 404 "Company not found"

    ticket = getTicket(companyId, ticketId)
    IF ticket NOT FOUND:
        RETURN 404 "Ticket not found"

    // Step 1: idempotency
    IF ticket.status IN ["assigned", "closed"]:
        RETURN 200 {
            ticketId,
            assignedAgentId: ticket.assignedAgentId,
            assignedAt: ticket.assignedAt,
            status: ticket.status,
            reason: ticket.reason
        }

    agents = getAgents(companyId)

    IF agents is EMPTY:
        RETURN 422 "Company has no agents configured"

    // Step 2: scheduled hours + active ticket count
    FOR EACH agent IN agents:
        agent.scheduledWeeklyHours = sumWindowDurations(agent.availabilityWindows)
        agent.activeTicketCount = countActiveTickets(agent.id)

    // Step 3: ticket density
    FOR EACH agent IN agents:
        IF agent.scheduledWeeklyHours > 0:
            agent.ticketDensity = agent.activeTicketCount / agent.scheduledWeeklyHours
        ELSE:
            agent.ticketDensity = NULL   // not density-eligible

    now = currentUtcTime()

    // Step 4: eligibility
    eligibleAgents = FILTER agents WHERE:
        agent.scheduledWeeklyHours > 0
        AND isCurrentlyAvailable(agent, now)
        AND agent.ticketDensity < MAX_DENSITY_THRESHOLD

    selectedAgent = NULL
    reason = ""

    // Step 5 & 6: pick lowest density, tie-break chain
    IF eligibleAgents is NOT EMPTY:
        selectedAgent = pickBy(eligibleAgents, [
            ascending(a => a.ticketDensity),
            ascending(a => a.lastAssignedAt ?? MIN_TIMESTAMP),
            ascending(a => a.id)
        ])
        reason = "Assigned based on availability and lowest ticket density"

    ELSE:
        agentsWithAnyAvailability = FILTER agents WHERE agent.scheduledWeeklyHours > 0

        // Step 7: soonest-next-window fallback
        IF agentsWithAnyAvailability is NOT EMPTY:
            FOR EACH agent IN agentsWithAnyAvailability:
                agent.nextWindowStart = computeNextWindowStart(agent, now)

            selectedAgent = pickBy(agentsWithAnyAvailability, [
                ascending(a => a.nextWindowStart),
                ascending(a => a.ticketDensity ?? INFINITY),
                ascending(a => a.lastAssignedAt ?? MIN_TIMESTAMP),
                ascending(a => a.id)
            ])
            reason = "Fallback: assigned outside eligibility (capacity and/or availability) to guarantee ownership"

        // Step 8: last resort
        ELSE:
            selectedAgent = pickBy(agents, [
                ascending(a => a.activeTicketCount),
                ascending(a => a.lastAssignedAt ?? MIN_TIMESTAMP),
                ascending(a => a.id)
            ])
            reason = "Last resort: no availability configured; assigned to guarantee ownership"

    // Step 9: record and return
    // Atomic claim: only succeeds if ticket is still unassigned
    updated = UPDATE ticket
              SET status = 'assigned', assigned_agent_id = selectedAgent.id,
                  assigned_at = now, reason = reason
              WHERE id = ticketId AND company_id = companyId AND status = 'unassigned'
              RETURNING *

    IF updated is NULL:
        // Someone else won the race between our read and our write.
        ticket = getTicket(companyId, ticketId)   // re-fetch the winner's result
        RETURN 200 { ticketId, status: ticket.status, assignedAgentId: ticket.assignedAgentId,
                     assignedAt: ticket.assignedAt, reason: ticket.reason }

    selectedAgent.lastAssignedAt = now
    save(selectedAgent)

    RETURN 200 {
        ticketId,
        assignedAgentId: selectedAgent.id,
        assignedAt: now,
        status: 'assigned',
        reason
    }
```

### Helpers

- `isCurrentlyAvailable(agent, now)` — checks if `now` (UTC) falls within any of the agent's UTC windows
- `computeNextWindowStart(agent, now)` — finds the earliest time at or after `now` when the agent is available, wrapping across the week boundary if needed.
- `sumWindowDurations(windows)` — sums (`window.durationMinutes`) across all windows
- `countActiveTickets(agentId)` — counts tickets where `assignedAgentId = agentId` AND `status = 'assigned'`

### Concurrency: Per-Company Assignment Queue

The atomic claim in Step 9 (`UPDATE ... WHERE status = 'unassigned'`) only protects races on the *same* ticket. Concurrent assigns on *different* tickets in the same company can still read stale density and pick the same agent.

Serialize `assignTicket` per company with an in-memory FIFO queue keyed by `companyId`: Steps 2–9 run only at the front of that company's queue. Different companies run in parallel. (Scaling note: §9.)

## 6. Main UI Flow

**Company scope for this trial:** only one company is seeded; see §9.

### 6.1 Check coverage gaps

Dashboard loads → `GET /agents` → frontend computes 30-min slot union across all agents' windows client-side → renders weekly Gantt, uncovered slots highlighted red.

### 6.2 Assign a ticket

Tickets table → lead clicks **Assign** on an unassigned row → `POST /tickets/:id/assign` → row updates in place with assigned agent + reason (loading state during the call).

### 6.3 Check a ticket

Tickets table shows status, agent, reason inline → lead expands row / hovers tooltip for full assignment detail (no extra API call — data already in `GET /tickets` response).

### 6.4 Check an agent's tickets and load

Agents section → frontend joins the `GET /agents` and `GET /tickets` responses by `assignedAgentId`, filters tickets to `status = 'assigned'`, and renders them on the matching agent card alongside scheduled weekly hours and ticket density.

### 6.5 Edit availability

Agent card → **Edit availability** → modal opens: server-stored UTC windows are converted back to local time using the agent's offset, and rendered as rows (day, start time, end time), with the timezone dropdown set to the current offset → lead edits rows or adds/removes via +/✕ → **Save** → `PUT /agents/:id/availability` sends offset + full local window list → server merges local overlaps, converts each window to a UTC start plus duration, and replaces the stored rows → modal closes, agent card + Gantt re-render.

## 7. Edge Cases

1. **Ticket lifecycle and idempotency** — assigning an assigned or closed ticket and closing a closed ticket return the existing result; closing an unassigned ticket returns `409`.
2. **Zero or missing availability** — an agent with zero scheduled hours has no density and is excluded from normal eligibility and next-window fallback. If no agent has availability, the last-resort path selects by fewest active tickets, then least-recently-assigned, then ID.
3. **No eligible agent** — unavailable or over-threshold agents enter the next-window fallback. A currently working, over-threshold agent has a next-window time of `now` and ranks ahead of future windows; the reason states that eligibility was overridden.
4. **Deterministic ties** — normal assignment uses least-recently-assigned then ID; next-window fallback uses density, least-recently-assigned, then ID.
5. **Zero or one agent** — a company with no agents returns `422`; a single agent is selected through the applicable normal or fallback path.
6. **UTC boundaries** — a window crossing UTC midnight or the weekly boundary remains one circular row; duration preserves an exact-midnight exclusive end without sentinels.
7. **Overlapping or adjacent windows** — same-day local windows are merged before conversion so scheduled hours are not double-counted.
8. **Offset change** — the modal resubmits the displayed local schedule with the new fixed offset, and UTC starts are recalculated in the same save.
9. **Concurrent assignments** — a conditional ticket update prevents duplicate assignment of the same ticket; the per-company queue prevents stale-density selection across different tickets.
10. **Cross-company IDs** — a ticket or agent outside the requested company is rejected as `404`; the composite foreign key prevents cross-company assignment in the database.
11. **Input boundaries** — malformed IDs and invalid offsets/windows return `400`; an empty `windows` array is valid and produces zero scheduled hours.

## 8. Test Plan

### 8.1 Unit Tests

Cover pure business logic:

1. Local→UTC start conversion across whole-hour, half-hour, and boundary offsets (UTC+14 and UTC−12), including normalized negative modulo
2. Availability checks for windows crossing UTC midnight and the Saturday/Sunday boundary, asserting one stored row works on both sides of the boundary
3. UTC→local round-trip conversion, including preserving displayed wall-clock times when the fixed offset changes
4. Local same-day overlap/adjacency merging before conversion
5. Scheduled weekly hours calculation by summing durations, including boundary-crossing windows
6. Ticket density calculation
7. Each branch of the assignment algorithm independently (eligible-path, fallback, last-resort)
8. Tie-break ordering at each step
9. `computeNextWindowStart` returns `now` for an agent currently inside a window (edge case #3), not a future occurrence of that window

### 8.2 API Tests

Hit every endpoint with valid and invalid inputs; assert response bodies and status codes:

1. Happy-path coverage for all five endpoints (`GET /agents`, `PUT /availability`, `GET /tickets`, `POST /assign`, `POST /close`)
2. Assign idempotency — call twice; second call returns the same assignment
3. Close idempotency — already-closed returns existing `closedAt`
4. Close invalid transition — unassigned ticket → `409`
5. Assignment fallback contracts: unavailable/over-threshold agents, no configured availability, and a company with zero agents (`422`)
6. Cross-company ID mismatch → `404` (edge case #10)
7. Malformed UUID path parameter on each endpoint → `400` (edge case #11)
8. `PUT /availability` with `windows: []` → `200`, agent's `scheduledWeeklyHours` becomes `0` (edge case #11)
9. Concurrency: fire N concurrent `assign` calls for N different unassigned tickets in the same company; assert each ticket gets assigned, no ticket is double-assigned, and the resulting distribution follows the lowest-density rule (for example, agents scheduled for 40 and 20 hours receive tickets in an approximately 2:1 ratio) rather than requiring equal raw ticket counts (edge case #9)
10. Concurrency: fire concurrent `assign` calls for the *same* ticket; assert exactly one produces the fresh assignment and the rest return the identical idempotent result (edge case #9)

### 8.3 UI Tests

Smoke-test the SPA: page load and each main user flow (§6):

1. Dashboard loads; stats bar, Gantt, agents, and tickets render
2. Coverage gaps appear as red-highlighted slots on the Gantt
3. Assign from an unassigned ticket row; row updates with agent + reason
4. Close an assigned ticket; status and active workload update
5. Edit availability modal: open pre-filled in local time, save, confirm agent card + Gantt refresh

## 9. Simplifications

- **Single process:** the per-company assignment queue (§5) is in-memory and correct for one Node process and is lost on restart. Multi-instance deployment would need a DB-level lock (e.g. `SELECT ... FOR UPDATE` on the company's agent rows) instead.
- **Single company in the UI:** one company is seeded; its `companyId` is hardcoded in the frontend. Endpoints are already scoped by `companyId` if a selector is added later.
