# Repository Guidelines

## Project Structure & Module Organization
`app/` holds runtime code for **The Well**: `welld.js` (Express host + y-websocket relay), `persistence.js` (Pit snapshot I/O), and `static/` for the Creator and Viewer canvases. Binary Pit state lands in `app/pits/<slug>.yjs`; keep roughly 500 MB free there. Docs such as `requirements.md` and `naming.md` live at repo root—update them alongside any behavioral change. Tests belong under `tests/` mirroring the `app/` tree (e.g., `tests/persistence.test.ts`).

## Build, Test, and Development Commands
- `npm install` — install Node/Express/Yjs deps inside `app/`.
- `npm run dev` — run The Well with live reload for local feature work.
- `docker compose up --build` — reproduce the single-node Well exactly as others will run it.
- `npm test` — execute unit and integration suites; required before pushing.
- `npm run lint` — apply ESLint/Prettier rules; run with `--fix` before commits.

## Coding Style & Naming Conventions
Use modern ECMAScript modules, 2-space indentation, and prefer const + arrow functions. Follow the naming canon in `naming.md`: write about **SyncPit** (project), **The Well** (daemon), **Pit/PitSlug/PitToken**, and verbs _start/jump/drop/bail_. Files and exports should stay lowercase and hyphenated (`pit-router.ts`), while classes use PascalCase. Keep modules single-purpose; factor shared helpers into `app/lib/` before duplication.

## Testing Guidelines
Primary framework is Jest with `@y-js` mocks. Mirror file names (`persistence.js` → `persistence.test.ts`) and isolate network-heavy flows into integration tests tagged `@pit`. Gate merges on `npm test` and target >85% statement coverage for `persistence` and WebSocket handlers. When adding rate-limit logic, include regression tests that cover quota exhaustion and recovery timing.

## Commit & Pull Request Guidelines
Commits follow imperative, scope-prefixed subjects (`well: add pit eviction cap`). Group related file changes per commit and keep messages under 72 chars. Pull requests must describe motivation, summarize risk, link any tokens/issues, and include run results (`npm test`, `docker compose up`). Attach screenshots or GIFs for canvas-facing changes so reviewers can assess rendering without running the pit.

## Security & Ops Notes
Never check real PitTokens into git. Document new quotas or headers in `requirements.md` and expose env toggles via `.env.example`. When touching persistence or limits, mention migration or disk-impact steps in the PR so operators can rehearse them before rollout.
