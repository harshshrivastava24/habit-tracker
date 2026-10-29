# Habit Tracker – Product Requirements Document

Full-stack take-home assignment · Stack: Express + MongoDB (server) · React + Vite (client) · Version 1.1

## 1. Overview

A small, usable Habit Tracker where users sign up, create daily habits, mark them complete per date, view history on a monthly calendar, and see statistics derived from real completion data.

**Primary goals:** correctness, secure auth, ownership enforcement, no duplicate completions, honest statistics, clear engineering decisions, setup that works from a clean checkout.

**Build order:** (1) initialize `client/`, (2) build `server/` completely with tests, (3) build the client against the finished API, (4) add P1 extras, (5) README + demo GIF.

**Non-goals:** external fitness integrations, social features, PDF export, password-reset emails, deployment.

## 2. Tech stack (pin exact versions at install time)

| Layer | Choice | Notes |
| --- | --- | --- |
| Runtime | Node.js 20 LTS+ | Declare in `engines` and README |
| Server | Express + TypeScript | Run in dev with `tsx watch` |
| DB | MongoDB + Mongoose | MongoDB Atlas free tier or a local `mongod`; no Docker |
| Validation | express-validator | One central error formatter |
| Auth | bcrypt (or argon2), jsonwebtoken | Access token in client memory (Bearer header), refresh token in an httpOnly cookie |
| Server hardening | express-rate-limit, cookie-parser | No `cors`, no `helmet`; same-origin setup. Call `app.disable('x-powered-by')` |
| Server tests | Vitest + Supertest + mongodb-memory-server | Committed to the repo; no external DB needed |
| Client | React + Vite + TypeScript + React Router | SPA; Tailwind CSS for styling |
| Client data | axios + small custom hooks | One configured axios instance; no TanStack Query, no Redux |
| Client forms | Controlled inputs + small validator functions | No React Hook Form or Zod; server field errors shown per field |
| Client tests | Vitest + React Testing Library | 3–5 focused tests, committed |
| Deploy | Render, one web service | Express serves `client/dist` in production |

## 3. Repository structure

```
habit-tracker/
  README.md
  AGENTS.md                # rules for the AI coding agent (section 14)
  .gitignore               # .env, node_modules, dist, coverage
  docs/PRD.md
  server/
    package.json  tsconfig.json  tsconfig.build.json  .env.example
    src/
      app.ts               # express app (no listen) - used by tests
      server.ts            # connects DB + listens (+ serves client/dist in production)
      config/              # env.ts (validated), db.ts
      models/              # User, Habit, Completion, RefreshToken
      routes/              # auth, habits, completions, dashboard, (extras)
      controllers/
      services/            # statsService, streakService, authService
      middleware/          # requireAuth, validate, errorHandler, notFound, rateLimit
      validators/
      utils/               # AppError, dateUtils, asyncHandler
    tests/                 # committed to the repo; excluded from the build output
  client/                  # Vite + React + TypeScript
    src/
      api/                 # axios instance, interceptors, one file per resource
      components/          # reusable UI components (section 9)
      context/             # AuthContext (holds the access token in memory)
      hooks/               # useHabits, useCompletions, useStats
      pages/               # Login, Signup, Dashboard, Habits, HabitDetail
      routes/              # ProtectedRoute
      tests/
```

## 4. Core concepts and global rules

### 4.1 Dates

- All habit/completion days are **calendar date strings `YYYY-MM-DD`**, never timestamps, in the DB, API, and UI.
- A date string is valid only if it is a real calendar date (reject `2026-02-30`).
- **Future-date rule:** a completion date may not be later than *UTC today + 1 day* (this accommodates every timezone, including IST). Documented limitation: the server does not store per-user timezones.
- A completion date may not be earlier than the habit's `startDate`.

### 4.2 Ownership

- Every habit/completion query includes the authenticated `userId`: `{ _id, userId }`.
- If a record does not exist or is not the user's, return **404** (never 403) so IDs cannot be probed.
- Invalid ObjectId format in `:id` → **404** `NOT_FOUND`.
- Clients can never set `userId`, `archivedAt`, or `_id` via request bodies (whitelist fields).

### 4.3 Error shape (all errors)

```json
{ "error": { "code": "VALIDATION_ERROR", "message": "Name is required", "details": { "name": "This field is required" } } }
```

Codes: `VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `INVALID_CREDENTIALS` (401), `NOT_FOUND` (404), `EMAIL_TAKEN` (409), `HABIT_ARCHIVED` (409), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500, no stack traces to client).

### 4.4 Status codes

200 OK, 201 Created, 204 No Content, 400 invalid input, 401 unauthenticated, 404 missing/not accessible, 409 conflict, 429 too many requests, 500 unexpected.

## 5. Data models (Mongoose)

### User

| Field | Type | Rules |
| --- | --- | --- |
| firstName | string | required, trimmed, 1–50 |
| lastName | string | required, trimmed, 1–50 |
| email | string | required, lowercased, **unique index**, valid format |
| passwordHash | string | never returned in any response (`select: false`) |
| createdAt/updatedAt | Date | timestamps |

### Habit

| Field | Type | Rules |
| --- | --- | --- |
| userId | ObjectId | required, indexed |
| name | string | required, trimmed, 1–100 |
| description | string | optional, max 500 |
| startDate | string `YYYY-MM-DD` | required |
| frequency | enum | `DAILY` only for now (enum leaves room for `WEEKLY`) |
| archivedAt | Date \| null | null = active |
| category | string \| null | **P1 hook**: optional, max 30; unused by core UI |
| reminderTime | string \| null | **P1 hook**: optional `HH:mm`; unused by core |
| createdAt/updatedAt | Date | timestamps |

Index: `{ userId: 1, archivedAt: 1 }`.

### Completion

| Field | Type | Rules |
| --- | --- | --- |
| habitId | ObjectId | required |
| userId | ObjectId | required (denormalized for fast ownership checks and stats) |
| date | string `YYYY-MM-DD` | required |
| createdAt | Date |  |

**Unique compound index `{ habitId: 1, date: 1 }`** – this is the data-layer duplicate protection. Additional index `{ userId: 1, date: 1 }` for stats.

### RefreshToken

| Field | Type | Rules |
| --- | --- | --- |
| userId | ObjectId | indexed |
| tokenHash | string | SHA-256 of the raw token; raw token is never stored |
| expiresAt | Date | **TTL index** (`expireAfterSeconds: 0`) |
| revokedAt | Date \| null | set on rotation/logout |
| createdAt | Date |  |

## 6. Authentication design

- **Access token:** JWT, \~15 min, returned in the JSON body and kept only in client memory (React state/context). Sent as `Authorization: Bearer <token>`. Never stored in localStorage, sessionStorage, or a cookie.
- **Refresh token:** random 64-byte string, \~7 days, httpOnly cookie `refresh_token`, `path=/api/auth`.
- Cookie flags: `httpOnly`, `sameSite=lax`, `secure` when `NODE_ENV=production`.
- **Why this split:** JavaScript can never read the refresh token, and the access token lives only in memory and is short-lived. Normal API calls use a header, so they are not CSRF-prone; only `/auth/refresh` and `/auth/logout` use the cookie, protected by `SameSite=Lax` and the scoped path. Documented as a known limitation.
- **Rotation:** `POST /auth/refresh` validates the refresh cookie against its stored hash, revokes it, and issues a new access token and a new refresh cookie. **Reuse detection:** if a revoked token is presented, revoke all of that user's refresh tokens and return 401.
- **Silent login:** on app load the client calls `POST /auth/refresh`. Success restores the session in memory; failure shows the login page. Show a loading screen meanwhile.
- **Single-flight refresh (client):** keep one in-flight refresh promise in the axios layer. Every request that gets a 401 awaits that same promise, then retries once. This stops parallel refresh calls (including React StrictMode's double effects in dev) from tripping reuse detection.
- **Logout:** revoke the refresh token in the DB, clear the cookie, and clear the access token from client state. Logout when already logged out is still 200.
- **Passwords:** bcrypt cost ≥ 10 (or argon2id). Policy: 8–72 characters, at least one letter and one number. Same generic message for unknown email and wrong password (`INVALID_CREDENTIALS`) to avoid account enumeration.
- Rate limit `/auth/login`, `/auth/signup`, `/auth/refresh` (e.g. 10 requests / 15 min / IP).
- **No CORS middleware:** the app is same-origin in dev (Vite proxy) and in production (Express serves the built client).

## 7. API specification

Base path `/api`. All JSON. All endpoints except signup/login/refresh/logout/health require `requireAuth`, which reads a valid `Authorization: Bearer <accessToken>` header. This follows the provided contract; additions are marked **(ext)**.

### 7.1 Auth

| Method & path | Body | Success | Errors |
| --- | --- | --- | --- |
| POST `/auth/signup` | `firstName, lastName, email, password` | 201 `{ user, accessToken }` + sets refresh cookie | 400, 409 `EMAIL_TAKEN` |
| POST `/auth/login` | `email, password` | 200 `{ user, accessToken }` + sets refresh cookie | 400, 401 |
| POST `/auth/logout` | – | 200 `{ message }`; revokes refresh token, clears cookie | – |
| POST `/auth/refresh` **(ext)** | – (cookie) | 200 `{ user, accessToken }` + rotated refresh cookie | 401 |
| GET `/auth/me` **(ext)** | – | 200 `{ user }` | 401 |
| GET `/health` **(ext)** | – | 200 `{ status: "ok" }` | – |

`user` = `{ id, firstName, lastName, email }`. Email is trimmed and lowercased before validation/storage.

### 7.2 Habits

| Method & path | Behavior |
| --- | --- |
| GET `/habits?status=active\|archived` | Default `active`. Returns `{ habits: [...] }` sorted by `createdAt` desc. Invalid status → 400. |
| POST `/habits` | Body: `name` (req), `description?`, `startDate` (req), `frequency` (req, `DAILY`), `category?`, `reminderTime?`. Returns 201 `{ habit }`. |
| GET `/habits/:id` | 200 `{ habit }` or 404. Works for archived habits too. |
| PATCH `/habits/:id` | Partial update of `name, description, startDate, frequency, category, reminderTime`. Never touches completions. 200 `{ habit }`. |
| DELETE `/habits/:id` | **Hard delete**: removes the habit **and all its completions** (explicit `deleteMany`, then the habit). 204. Documented: archive is the way to keep history. |
| POST `/habits/:id/archive` | Sets `archivedAt = now`. Idempotent. 200 `{ habit }`. |
| POST `/habits/:id/unarchive` | Clears `archivedAt`. 200 `{ habit }`. |

Validation: `name` 1–100 chars after trim (not blank); `description` ≤ 500; `startDate` real date; `frequency` in enum; unknown fields stripped. Changing `startDate` later never deletes older completions (they stay in history; stats simply use `max(from, startDate)`).

### 7.3 Completions

| Method & path | Behavior |
| --- | --- |
| GET `/habits/:id/completions?from=&to=` | Returns `{ completions: [{ date }] }` sorted ascending. Both params optional, validated, `from <= to`, max range 400 days. Allowed for archived habits. |
| PUT `/habits/:id/completions/:date` | **Idempotent upsert.** 201 if newly created, 200 if it already existed. Body: `{ completion: { habitId, date } }`. Rules: date valid, `>= startDate`, `<= UTC today + 1`. Archived habit → 409 `HABIT_ARCHIVED`. Race-safe: use `findOneAndUpdate` with `upsert: true` and catch Mongo error `11000`. |
| DELETE `/habits/:id/completions/:date` | Undo. 204 whether or not a record existed (idempotent). Habit missing/not owned → 404. Allowed on archived habits? **No**: 409 `HABIT_ARCHIVED` (history is frozen while archived). |

### 7.4 Dashboard

`GET /dashboard/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`

Defaults: `to` = UTC today, `from` = `to − 29 days` (last 30 days). `from <= to`, max range 366 days.

Response:

```json
{
  "period": { "from": "2026-10-01", "to": "2026-10-29" },
  "activeHabits": 4,
  "completionsThisWeek": 12,
  "weekRange": { "from": "2026-10-26", "to": "2026-11-01" },
  "completionsInPeriod": 61,
  "expectedCompletions": 98,
  "completionRate": 0.62,
  "perHabit": [ { "habitId": "...", "name": "Read", "completions": 20, "expected": 29, "rate": 0.69 } ]
}
```

**Definitions (document these in the README):**

- Stats cover **active (non-archived) habits only**.
- **Expected completions** for a habit = number of days from `max(from, habit.startDate)` to `min(to, allowedMaxDate)` inclusive (0 if the range is empty), where `allowedMaxDate` = UTC today + 1 day capped by `to`.
- **Completion rate** = `completionsInPeriod / expectedCompletions` (0 when expected is 0), rounded to 2 decimals.
- Only completions with `date` inside `[max(from, startDate), min(to, …)]` for that habit count, so numerator and denominator are consistent.
- **Completions this week** = completions in the ISO week (Monday–Sunday) containing `to`.
- Computed from Completion data via aggregation (`$match` by userId + date range, `$group` by habitId) plus a pure `statsService` function for the denominator logic so it is unit-testable.

## 8. P1 extras – design hooks (build after the core passes all tests)

The core schema and layout already leave room for these, so adding them requires no rewrites.

| Extra | Where it lives | Plan |
| --- | --- | --- |
| **Streaks** | `services/streakService.ts` | Pure function over a sorted date list. Current streak = consecutive days ending today (UTC+1 tolerance) or yesterday; longest streak = longest consecutive run. Endpoint `GET /habits/:id/streak` and/or include `currentStreak`/`longestStreak` in `GET /habits/:id`. |
| **Categories/areas** | `Habit.category` (already in the model) | Add `GET /habits?category=` filter and `GET /habits/categories` (distinct list). Client shows chips/filter. |
| **Export CSV** | `routes/export.ts` | `GET /export/completions.csv?from=&to=` streams rows `habit_name,date` for the user. Escape CSV special characters and guard against CSV/formula injection (prefix cells starting with `=`, `+`, `-`, `@`). |
| **Reminders** | `Habit.reminderTime` (already in the model) | Core stores the time only; the client uses the Notification API / in-app banner while the tab is open. No email. Documented limitation. |
| **Motivational quote** | client or `GET /quote` | Simplest: a static array in `server/src/data/quotes.ts` served by one endpoint (no external API, no key); the client displays it on the dashboard. |
| **Pomodoro timer** | client only | 25/5 timer component with local state; optional `PomodoroSession` model + `POST /pomodoro` later if time remains. |
| **Custom challenges** | new `Challenge` model | e.g. `{ userId, name, habitIds, startDate, endDate, targetDays }`; progress derived from completions. Build last, only if everything else is done. |

Rule: every extra gets its own route file, service, and tests, and must not change the behavior of core endpoints.

## 9. Client requirements (for the later phase)

**Now:** only initialize `client/` with Vite (React + TypeScript template), install `react-router-dom`, `axios` and Tailwind CSS, add the dev proxy for `/api`, and confirm it runs. **Do not build UI yet.**

**Later pages:**

1. `/signup`, `/login` with inline field errors and loading states.
2. `/dashboard` with stats cards (active habits, completions this week, completion rate with the period shown), today's habits as toggles, empty state.
3. `/habits` with active/archived tabs, create/edit modal, archive, delete with confirmation, empty state.
4. `/habits/[id]` with a month calendar (prev/next month, completed days highlighted, click a day to toggle).

Structure: `client/src/api/` holds one axios instance (`baseURL: '/api'`, `withCredentials: true`, a request interceptor that adds the Bearer token from memory, and a response interceptor with the single-flight refresh) plus one file per resource. No axios calls inside components. `hooks/` holds small data hooks (`useHabits`, `useCompletions`, `useStats`) returning `{ data, loading, error, refetch }`; refetch stats after any completion change.

Same-origin setup: in dev, Vite's `server.proxy` forwards `/api` to `http://localhost:5000`; in production, Express serves `client/dist` and falls back to `index.html` for non-API routes. Result: no CORS middleware anywhere. `ProtectedRoute` is for UX only; the server enforces access.

**Reusable components:** extract a component only when a piece of UI is used in more than one place or is a clear unit on its own. Ordinary buttons, inputs and labels stay plain elements styled with Tailwind classes; do not wrap them in components. The components to build:

- `Modal` and `ConfirmDialog`: one modal shell used for the habit form and for delete confirmation
- `HabitForm`: shared by create and edit
- `HabitCard`: used on the dashboard and the habits list
- `StatCard`: the dashboard statistics
- `Calendar`: month grid with prev/next and `onDayClick`, used on the habit detail page
- `EmptyState`, `ErrorMessage` (with retry) and `Spinner`: shared loading, empty and error states for every page
- `ProtectedRoute`: the route guard

States required everywhere relevant: loading, empty, success (toast), error (message + retry).

## 10. Environment variables (`server/.env.example`)

```
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/habit_tracker
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_COST=10
```

No real secrets in git. `config/env.ts` validates variables at startup and fails fast with a clear message.

**Repository hygiene:** `.gitignore` contains `.env`, `node_modules`, `dist`, and `coverage`. The `tests/` folders **are committed** (the assignment requires basic tests and instructions for running them); they are only excluded from the build output via `tsconfig.build.json`.

**Render deploy (basic):** one web service. Build command installs and builds the client, then the server. Start command runs the compiled server, which serves `client/dist`. Set the variables above in Render and use a MongoDB Atlas URI for `MONGODB_URI`.

## 11. Server build phases (each phase ends with a gate)

| Phase | Scope | Gate (must pass before moving on) |
| --- | --- | --- |
| S0 | Init repo, `.gitignore`, `server/` TypeScript project, scripts, lint, `.env.example`, `GET /health` | `npm run dev` starts; `/health` returns 200 |
| S1 | `config`, `AppError`, `asyncHandler`, `validate` middleware, `errorHandler`, `notFound`, rate limit | A test hits an unknown route and gets the standard error shape |
| S2 | Models (User, Habit, Completion, RefreshToken) with indexes | Model tests: unique email, unique habitId+date |
| S3 | Auth: signup, login, logout, refresh (rotation + reuse detection), me, `requireAuth` (Bearer header) | Auth tests green; password hash never in responses; refresh cookie is httpOnly |
| S4 | Habits CRUD + archive/unarchive with ownership | Ownership tests (user B gets 404 on A's habit) green |
| S5 | Completions PUT/DELETE/GET with all date rules | Duplicate, undo, archived, date-rule tests green |
| S6 | `statsService` + `GET /dashboard/stats` | Unit tests for denominator, including a mid-period `startDate` |
| S7 | Full test sweep, coverage of business rules, curl examples file | `npm test` all green from a clean checkout |
| S8 | Server README section | Setup works exactly as written |
| X1+ | P1 extras (section 8), one at a time | Each extra's tests green; core tests still green |
| D1 | After the client exists: Express serves `client/dist` in production; deploy to Render | Deployed URL supports signup, login, reload (silent refresh), and logout |

## 12. Testing plan

**Server (Vitest + Supertest + mongodb-memory-server):**

- Signup: validation errors, duplicate email 409, password never returned or stored in plain text.
- Login: wrong password and unknown email both 401 with the same message; success returns an access token and sets an httpOnly refresh cookie.
- Private endpoints return 401 without a Bearer token; expired/invalid token returns 401.
- Refresh: rotation works, old refresh token rejected, reuse revokes all tokens; logout invalidates the refresh token (refresh after logout fails).
- Habits: create/list/edit/delete/archive/unarchive; empty list; invalid payloads return field-level details; archived excluded from active list but returned for `status=archived`.
- Ownership: user B receives 404 on GET/PATCH/DELETE/archive/complete/undo for user A's habit; request bodies cannot override `userId`.
- Completions: PUT twice yields exactly one record; concurrent PUTs (`Promise.all`) yield one record; undo removes; date before startDate and far-future dates rejected; archived habit blocks mutation; invalid date strings rejected.
- Editing a habit keeps all completions; deleting a habit removes its completions.
- Stats: change after adding/removing a completion; denominator with mid-period `startDate`; zero-expected returns rate 0; archived habits excluded.
- Unit tests: `dateUtils` (validity, range, ISO week), `statsService`, `streakService` (later).

**Client:** form validation messages, empty state render, toggle completion calls the API layer, a 401 triggers one refresh and a retry, and a failed refresh redirects to login.

## 13. Definition of done

- [ ] All P0 requirements work end to end (auth, habits, completions, calendar, stats).
- [ ] Validation errors are useful and field-level on both server and client.
- [ ] Ownership enforced; duplicate completions impossible at the DB level.
- [ ] Stats derived from data; denominator documented and consistent.
- [ ] Passwords hashed; logout invalidates the session; no secrets committed.
- [ ] Tests pass with one command; setup works from a clean clone.
- [ ] README covers: track (Full-stack), features, setup, env vars, test commands, assumptions, known limitations, API deviations from the provided contract, curl examples, auth choice, delete behavior, stats definition.
- [ ] Demo GIF/video included or linked.

**Known limitations to state honestly:** no per-user timezone; the refresh cookie is protected by SameSite only (no CSRF token); reminders only while the app is open; no email flows; daily frequency only.

**API deviations to list in README:** added `/auth/refresh`, `/auth/me`, `/health`; `signup`, `login` and `refresh` return an `accessToken` in the body (sent back as a Bearer header) while the refresh token lives in an httpOnly cookie; 409 `HABIT_ARCHIVED` on completion mutation; 429 for rate limits; extra optional habit fields (`category`, `reminderTime`).

## 14. Rules for the AI coding agent (`AGENTS.md`)

Paste this into `AGENTS.md` at the repo root and reference it in every prompt.

```
# Project rules
- The source of truth is docs/PRD.md. If something is not specified there, STOP and ask; do not invent endpoints, fields, packages, or behavior.
- Work in phases (S0, S1, ...). Do only the phase I name. Do not start later phases or add extras.
- Only use the libraries listed in the PRD tech stack. Do not add a dependency without asking. Do NOT add cors, helmet, TanStack Query, Redux, React Hook Form, Zod, Next.js, or Docker.
- Install the latest stable versions and show me the versions in package.json.
- Before using any library API you are not 100% sure about, read its installed docs/types in node_modules or the official docs. Do not guess method names or options.
- Dates are YYYY-MM-DD strings. Never use timestamps for habit/completion days.
- Every habit/completion query must filter by the authenticated userId. Return 404, never 403.
- The access token lives only in client memory and is sent as a Bearer header. The refresh token lives only in the httpOnly cookie. Never use localStorage for tokens.
- All errors use the standard error shape. Never leak stack traces.
- Never hardcode secrets. Read config from env via config/env.ts.
- Frontend: all HTTP goes through src/api/ (axios); extract a component into src/components/ only when markup is used in more than one place; do not create wrapper components for plain buttons, inputs, or labels.
- After each phase: run the build, run the tests, and paste the real command output. Never claim something works unless you ran it.
- Write tests for the phase's business rules in the same phase, in the tests/ folder (committed to git).
- Keep files small; follow the folder structure in the PRD. No dead code, no placeholder TODO logic presented as complete.
- At the end of each phase, list: files created/changed, commands run with results, anything that deviates from the PRD.

# Git workflow
- Never commit, push, merge, or rebase on `main`. Never run `git push origin main` or `git checkout main` followed by changes.
- Before starting any phase, make sure you are on a working branch named `work/<phase>` (e.g. `work/s3-auth`), created from `staging`. If you are on `main`, stop and switch.
- Commit small and often on the working branch with clear messages (e.g. `S3: add refresh token rotation`).
- When a phase is done and its tests pass, merge the working branch into `staging` (`git checkout staging && git merge --no-ff work/<phase>`), then switch back to a new working branch for the next phase.
- Never force-push (`--force`) and never delete `main` or `staging`.
- Do not run any git command that rewrites history without asking me first.
- Before every merge, run the tests and paste the output. If tests fail, do not merge.
```
