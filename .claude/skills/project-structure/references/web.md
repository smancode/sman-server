# web/ - Admin Dashboard

## Purpose

React 19 SPA for admin management. Features broadcast CRUD, client listing, file upload, stats visualization, and achievement leaderboard. No routing library (tab switching via state). No CSS framework (hand-written CSS).

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app component, tab switching logic |
| `src/api.ts` | API client with bearer token auth |
| `src/types.ts` | TypeScript types matching server |
| `src/main.tsx` | React entry point |
| `src/app.css` | Global styles with custom properties |

## Components

| Component | Purpose |
|-----------|---------|
| `DashboardTab` | Stats overview, feature toggles (Stardom/Hub Dev Mode) |
| `BroadcastsTab` | Broadcast CRUD with soft delete |
| `ClientsTab` | Client listing with search/filter |
| `LeaderboardTab` | ⚠️ NEW Achievement leaderboard with pagination, search, sorting |
| `ErrorReportsTab` | Client error log viewer |
| `FeedbacksTab` | User feedback management |
| `DownloadsTab` | Download statistics |
| `UploadTab` | File upload interface |
| `PublishTab` | Generate update manifests |

## Directories

| Directory | Purpose |
|-----------|---------|
| `components/` | React components (all tab views, forms, lists) |
| `stores/` | Zustand state management (auth store) |
| `locales/` | i18n translations (en-US, zh-CN) - ⚠️ NEW leaderboard keys |
| `lib/` | Utility functions |

## Key Technologies

- **React 19** - UI framework
- **Zustand** - State management
- **Vite** - Build tool and dev server
- **TypeScript** - Type safety

## Development

```bash
cd web
pnpm dev          # Vite dev server on :4000 with proxy to backend
pnpm build        # Build to dist/public/
```

## Key Patterns

- Token auth stored in `localStorage` under `sman-admin-token`
- Vite dev server proxies `/admin` to API server
- Tab switching via React state (no routing library)
- Custom CSS with CSS custom properties (no framework)
- ⚠️ NEW: Leaderboard uses JSON extraction for multi-dimensional sorting
- ⚠️ NEW: Pagination with configurable page size and search filtering
