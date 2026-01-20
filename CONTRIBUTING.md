# Contributing to nao

Thank you for your interest in contributing to nao! 🎉

## Getting Started

### Prerequisites

- Node.js 20+
- Bun
- Python 3.10+
- uv (Python package manager)

### Setup

1. **Clone the repository**

    ```bash
    git clone https://github.com/naolabs/chat.git
    cd chat
    ```

2. **Install dependencies**

    ```bash
    npm install
    ```

3. **Set up environment variables**

    ```bash
    cp .env.example .env
    ```

    Edit `.env` and add your API keys.

4. **Start development servers**

    ```bash
    npm run dev
    ```

    This runs:
    - Backend API on `http://localhost:5005`
    - Frontend dev server on `http://localhost:3000`

## Project Structure

```
chat/
├── apps/
│   ├── backend/     # Bun + Fastify + tRPC API server
│   └── frontend/    # React + Vite + TanStack Router
├── cli/             # Python CLI (nao-core package)
└── ...
```

## Development Commands

| Command                    | Description                          |
| -------------------------- | ------------------------------------ |
| `npm run dev`              | Start backend + frontend in dev mode |
| `npm run dev:backend`      | Backend only (Bun on :5005)          |
| `npm run dev:frontend`     | Frontend only (Vite on :3000)        |
| `npm run lint`             | Run ESLint on both apps              |
| `npm run lint:fix`         | Fix lint issues                      |
| `npm run format`           | Format with Prettier                 |
| `npm run -w backend test`  | Run backend tests                    |
| `npm run -w frontend test` | Run frontend tests                   |

### Database Commands

| Command                          | Description                         |
| -------------------------------- | ----------------------------------- |
| `npm run pg:start`               | Start PostgreSQL via docker-compose |
| `npm run pg:stop`                | Stop PostgreSQL                     |
| `npm run -w backend db:generate` | Generate migrations                 |
| `npm run -w backend db:migrate`  | Apply migrations                    |
| `npm run -w backend db:studio`   | Open Drizzle Studio GUI             |

## Making Changes

### Adding a New Feature

- **Database table**: Edit `apps/backend/src/db/sqliteSchema.ts`, run `db:generate` then `db:migrate`
- **tRPC procedure**: Add to `apps/backend/src/trpc/chatRoutes.ts` (auto-exported to frontend)
- **Agent tool**: Implement in `apps/backend/src/agents/tools/`, register in `tools.ts`
- **Frontend route**: Create `.tsx` file in `apps/frontend/src/routes/` (file-based routing)

### Code Style

- Run `npm run lint:fix` before committing
- Run `npm run format` to format code with Prettier
- Follow existing patterns in the codebase

## Publishing to PyPI

```bash
cd cli
python build.py          # Build everything
python build.py --bump minor  # Build with version bump
```

To publish:

```bash
uv publish dist/*
```

Or from root:

```bash
npm run publish              # Patch version
npm run publish minor        # Minor version
npm run publish major        # Major version
```

## Submitting Changes

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Questions?

- 💬 [Join our Slack](https://join.slack.com/t/naolabs/shared_invite/zt-3cgdql4up-Az9FxGkTb8Qr34z2Dxp9TQ)
- 🐛 [Open an issue](https://github.com/naolabs/chat/issues)

Thank you for contributing! 🙏
