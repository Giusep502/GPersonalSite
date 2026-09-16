# Project ground rules

Personal website. Solo-maintained, frontend-only, no backend/API routes.

## Stack

- Vite + React (plain JS/JSX, no TypeScript — never add `.ts`/`.tsx` files or a `tsconfig.json`)
- `@react-three/fiber` + `@react-three/drei` for Three.js scenes
- Plain CSS via CSS Modules (`*.module.css` co-located with the component) — no Tailwind, no CSS-in-JS
- npm only — do not add a `yarn.lock` or `pnpm-lock.yaml`

## Conventions

- No test framework and no test files. Verify changes by running `npm run dev` and checking the browser.
- Comments only where the code's intent isn't obvious from reading it (a workaround, a non-obvious invariant, a subtle timing/ordering constraint). Don't restate what the code already says.
- Folder layout under `src/`:
  - `components/` — 2D UI components
  - `scenes/` — react-three-fiber scene components (anything with a `<Canvas>`)
  - `styles/` — global CSS (resets, CSS variables)
- Run `npm run lint` before considering a change done.
