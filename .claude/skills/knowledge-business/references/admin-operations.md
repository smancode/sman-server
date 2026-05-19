# Admin Dashboard Operations

## Authentication
All `/admin/*` routes require Bearer token: `Authorization: Bearer <ADMIN_TOKEN>`

## Broadcast CRUD
- **POST /admin/broadcast**: Create broadcast (`{ id, title, body }`)
- **GET /admin/broadcasts**: List all broadcasts (ordered by created_at DESC)
- **DELETE /admin/broadcast/:id**: Soft-delete broadcast (set `active=0`)

## Client Management
- **GET /admin/clients**: List all clients with workspace details
  - Returns: `[{ client_id, version, hostname, ip, first_seen, last_seen, active_sessions, workspaces: string[] }]`

## Statistics
- **GET /admin/stats**: Aggregated stats
  - `totalClients`: COUNT(*) from clients
  - `onlineClients`: clients with last_seen within 1 hour
  - `totalReports24h`: reports within last 24 hours
  - `activeBroadcasts`: broadcasts with active=1

## Error Reports
- **GET /admin/error-reports?limit=100`: Paginated error report list
- **DELETE /admin/error-reports/:id`: Delete specific error report

## Feedback
- **GET /admin/feedbacks?limit=100`: Paginated feedback list
- **DELETE /admin/feedbacks/:id`: Delete specific feedback

## Analytics
- **GET /admin/pageviews?days=30`: Daily pageview counts
- **GET /admin/pageviews/ips?days=30`: IP-based pageview stats
- **GET /admin/downloads?days=30`: Download stats and logs

## Settings
- **GET /admin/stardom-dev-mode`: Check dev mode flag
- **PUT /admin/stardom-dev-mode`: Toggle dev mode (`{ enabled: boolean }`)

## Key Business Rules
- Bearer token enforced at middleware level
- Soft delete pattern for broadcasts (preserve history)
- Time-based filters with min/max constraints (1-365 days)
- Settings stored in `hub_settings` table with key-value pairs

## Source
`src/routes/admin.ts:9-230`
