# CLAUDE.md

Guidance for Claude Code working in this repo.

## Commands

```bash
npm run dev          # Start dev server (Turbopack)
npm run build        # Production build
npm run lint         # ESLint
npx shadcn@latest add <component>  # Add shadcn/ui components
vercel deploy --prod # Deploy to production
vercel env pull .env.local --yes  # Pull env vars (BLOB_READ_WRITE_TOKEN)
```

## Architecture

Personal LSAT Logical Reasoning tutor for two users. Next.js 16 App Router, Vercel Blob for persistence, no database, no auth.

### Core data model

`Quiz` is a **reusable config** — chapters, count, mode, time limit. It does NOT pin a question list. Legacy pre-migration `Quiz` blobs may still have `questions[]`; the runtime treats those as a fallback.

`Attempt` carries its own **fresh question snapshot** sampled at attempt start (`POST /api/attempt/start`). Each take of the same quiz produces a new attempt with different questions. Attempts also own flags and notes.

See `src/lib/types.ts` for the full shape.

### Data flow

The dashboard admin is also the test-taker, so there's no share-a-link step. Every entry point starts an attempt and jumps straight into `/take`.

1. **Create** (`/admin/create` → `POST /api/quiz/create` → `POST /api/attempt/start`): pick chapters via the dropdown modal, count, mode. Server saves a `Quiz` config (no questions), then the client immediately requests an attempt and pushes to `/quiz/[id]/take`. If create succeeds but start fails, the client holds the quiz id and the next Begin tap retries only the start leg.
2. **Start attempt** (`POST /api/attempt/start`): server samples questions via `src/lib/sampling.ts`, stores them on the attempt.
3. **Take** (`/quiz/[quizId]/take`): fetches `GET /api/attempt/[id]?view=take` for questions. Answers tracked in `answersRef` + `localStorage`. Exam mode shows countdown; auto-submits at 0:00.
4. **Submit** (`POST /api/attempt/[id]/submit`): grades against the attempt's own question snapshot. Server enforces timeout via `startedAt + timeLimitSeconds` with 2s grace. Returns full results payload.
5. **Results** (`/quiz/[quizId]/results/[attemptId]`): reads from `sessionStorage.latest-quiz-results` first, falls back to `GET /api/attempt/[id]`. Notes autosave via debounced `PATCH`; unmount flushes pending save with `keepalive`.
6. **Dashboard** (`/admin` → `GET /api/dashboard`): weak chapters, scores, flagged/missed counts. "Recent sets" row has a primary **Take** button that starts a fresh attempt and pushes to `/take` — no copy-link.
7. **Library** (`/library`): flagged + missed across all attempts, with bulk-drill from `POST /api/drill`.
8. **Drill** (`POST /api/drill`): spawns a new attempt in three kinds — `wrong-only`, `drill` (chapter pool), `questions` (specific IDs).

### Blob storage (`src/lib/blob.ts`)

All data as JSON under `lsat/`:
- `lsat/quizzes/{id}.json` — quiz config (new) or legacy quiz with questions
- `lsat/attempts/{id}.json` — attempt (new: owns questions / flags / notes)

`getIndex()` and `listAttempts()` rebuild by listing all blobs — no shared mutable index.

Patterns:
- `writeBlob` uses `addRandomSuffix: false, allowOverwrite: true`
- `readBlob` bypasses fetch cache + timestamp cache-busting
- All GET API routes use `export const dynamic = "force-dynamic"` (except `/api/chapters` which is static)
- Module-level `urlCache` gives read-after-write consistency inside a warm lambda

### Question bank

`src/lib/data/question-bank.ts` is server-only. Clients should never import it — they fetch `GET /api/chapters` for chapter metadata and counts. `src/lib/sampling.ts` wraps the bank for server use.

### Client state during the take

- `answersRef` — synchronous source of truth for answers
- `flaggedRef` — synchronous source of truth for flags
- `localStorage.answers-{attemptId}` / `flagged-{attemptId}` / `index-{attemptId}` — survive refresh
- `sessionStorage.attempt-{quizId}` — `{ attemptId, startedAt, timeLimitSeconds }`

### Design language

Editorial soft-luxury. Fraunces (display serif) + Instrument Sans (body), cream paper, deep rose primary, gold accents, sage for "correct." Exam mode toggles the `.exam-mode` class on `<html>` for darker chrome. Sparkle particles refined (gold, fewer). All dates shown in `America/Chicago`.

## Known gotchas

- Vercel Blob is eventually consistent — the `sessionStorage.latest-quiz-results` pass-through exists specifically to avoid read-after-write on the results page.
- React Strict Mode double-runs effects — never read-then-delete sessionStorage in a `useEffect`; use a `useState` initializer.
- `getIndex()` / `listAttempts()` read every blob on every call. Fine for two users; cache before you scale.
- Auto-submit and manual submit both guard via `submittingRef`. JS is single-threaded so the check-then-set is safe; the server also rejects a second submit with 400.
- `safe-area-inset-*` only works because `layout.tsx` exports a `viewport` with `viewportFit: "cover"`.

@AGENTS.md
