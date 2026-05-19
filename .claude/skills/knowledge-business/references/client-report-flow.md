# Client Report Submission Flow

## Endpoint
`POST /api/report`

## Request Structure
```json
{
  "payload": "<base64 encrypted blob>",
  "timestamp": 1716200000,
  "pskVersion": 1
}
```

## Process Flow
1. **Validation**: Check `pskVersion === 1` and timestamp within 5-minute window
2. **Decryption**: AES-256-GCM decrypt payload using PSK
3. **Data Extraction**: Extract `ReportPayload` (clientId, version, hostname, ip, activeSessions, reportTime, workspaces[])
4. **Database Operations**:
   - `upsertClient`: Insert new client or update existing (version, hostname, ip, last_seen, active_sessions)
   - `insertReport`: Insert report row with client_id, report_time, active_sessions
   - `replaceWorkspaces`: Delete and re-insert all workspace paths for this client
5. **Skill Commands**: Optional skill-auto-updater commands fetched via `getSkillCommands(clientId)`
6. **Response**: `{ ok: true, serverTime: ISO8601, commands: string[] }`

## Key Business Rules
- Replay protection via 5-minute timestamp window
- Client records upserted (first_seen immutable, last_seen updated)
- Workspace list replaced (not merged) on each report
- Active sessions count tracked in real-time

## Source
`src/routes/report.ts:23-66`, `src/db.ts:178-204`
