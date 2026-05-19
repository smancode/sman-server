# web/ - Admin Dashboard

## Purpose

React 19 SPA for admin management. Features broadcast CRUD, client listing, file upload, and stats visualization. No routing library (tab switching via state). No CSS framework (hand-written CSS).

## Key Files

| File | Purpose |
|------|---------|
| `src/App.tsx` | Main app component, tab switching logic |
| `src/api.ts` | API client with bearer token auth |
| `src/types.ts` | TypeScript types matching server |
| `src/main.tsx` | React entry point |
| `src/app.css` | Global styles with custom properties |

## Directories

| Directory | Purpose |
|-----------|---------|
| `components/` | React components (BroadcastForm, ClientList, etc.) |
| `stores/` | Zustand state management |
| `locales/` | i18n translations |
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
