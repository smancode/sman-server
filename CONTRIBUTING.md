# Contributing to Sman Server

Thanks for your interest in contributing to Sman Server! This guide will help you get started.

## Quick Links

- [README](./README.md)
- [Security Policy](./SECURITY.md)
- [License](./LICENSE)

## How to Contribute

### Bug Reports

1. Search [existing issues](https://github.com/smancode/sman-server/issues) to avoid duplicates
2. Open a new issue with:
   - Clear title and description
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment info (OS, Node.js version)

### Feature Requests

1. Check [existing issues](https://github.com/smancode/sman-server/issues) first
2. Open an issue with the `feature` label
3. Describe the use case and expected behavior

### Pull Requests

1. Fork the repository
2. Create a feature branch from `master`
   ```bash
   git checkout -b feature/your-feature-name
   ```
3. Make your changes
4. Ensure tests pass
   ```bash
   pnpm test
   ```
5. Ensure the build succeeds
   ```bash
   pnpm build
   ```
6. Submit a PR with a clear description of the changes

### Before You PR

- [ ] Code compiles without errors (`pnpm build`)
- [ ] Tests pass (`pnpm test`)
- [ ] No hardcoded secrets or credentials
- [ ] Files stay under 300 lines (TypeScript)
- [ ] Commit messages are clear and descriptive

## Development Setup

### Prerequisites

- **Node.js 22 LTS**
- **pnpm** package manager

### Getting Started

```bash
# Install dependencies
pnpm install

# Start development
pnpm dev                    # API server on :5882
cd web && pnpm dev          # Admin UI on :4000
```

### Project Structure

```
sman-server/
├── src/                    # Server source
│   ├── index.ts            # Express app setup
│   ├── db.ts               # SQLite operations
│   ├── crypto.ts           # AES-256-GCM
│   ├── types.ts            # TypeScript interfaces
│   └── routes/             # API routes
├── web/src/                # React admin dashboard
├── tests/                  # Vitest tests
└── data/                   # DB + update files
```

### Tech Stack

| Layer | Technology |
|-------|-----------|
| Server | Node.js, Express 5, better-sqlite3 |
| Frontend | React 19, TypeScript, Vite |
| Crypto | AES-256-GCM (pre-shared key) |
| Testing | Vitest |

## Coding Guidelines

### Core Principles

- **Keep it simple**: Don't add unnecessary abstractions or features
- **Strict parameters**: No default values, no silent fallbacks — validate and throw
- **No ORM**: Use raw SQL via better-sqlite3
- **Under 300 lines**: Split files that exceed the limit

### Key Rules

1. **Strict parameter validation** — missing params throw, never silently default
2. **Test your changes** — write tests for new functionality
3. **One responsibility per file** — keep modules focused
4. **ESM imports use `.js` extensions** — TypeScript convention for ESM

## Code of Conduct

Be respectful, constructive, and inclusive. We're all here to build something great together.

## License

By contributing to Sman Server, you agree that your contributions will be licensed under the [MIT License](./LICENSE).
