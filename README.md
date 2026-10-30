# Habit Tracker – Full-Stack Take-Home

**Live demo:** https://habit-tracker-jv8k.onrender.com/

A robust, production-ready Habit Tracker web application built with Express, TypeScript, and MongoDB (Server) and React, Vite, and Tailwind CSS (Client).

---

## 1. Track & Tech Stack

- **Track:** Full-stack (Server + Client)
- **Runtime:** Node.js 20 LTS+ (tested on Node v20/v22)
- **Server:** Express 4 + TypeScript (ESM, strict type checking)
- **Database:** MongoDB with Mongoose (indexes, TTL, compound uniqueness)
- **Authentication:** Access token (JWT, short-lived in client memory) + Refresh token (random 64-byte hex in `httpOnly` cookie, SHA-256 hashed in DB with rotation & reuse detection)
- **Password Security:** `bcrypt` with cost factor >= 10
- **Validation:** `express-validator` with centralized error formatting
- **Rate Limiting:** `express-rate-limit` (10 requests / 15 min / IP on auth routes)
- **Testing:** Vitest + Supertest + `mongodb-memory-server` (self-contained, no external database needed)
- **Client:** React 19 + Vite + TypeScript + Tailwind CSS (Vite dev proxy forwarding `/api` to `http://localhost:5000`)

---

## 2. Features

- **Authentication & Session Lifecycle:**
  - Secure registration and login with input validation and case-insensitive unique email handling.
  - Constant-time password hashing via `bcrypt`. Generic credentials error (`INVALID_CREDENTIALS`) preventing account enumeration.
  - Refresh token rotation: each refresh revokes the presented token and issues a new pair.
  - Automatic reuse detection: presenting an already-revoked refresh token revokes all active sessions for that user.
  - Idempotent logout: revokes tokens in DB and clears the scoped `httpOnly` cookie.
- **Habits Management (CRUD + Archival):**
  - Create daily habits with mandatory name and calendar `startDate` (`YYYY-MM-DD`).
  - Strict ownership enforcement: users can only view, edit, archive, or delete their own habits (unauthorized access returns `404 NOT_FOUND`, never `403`, to prevent ID probing).
  - Filter active vs. archived habits (`GET /api/habits?status=active|archived`).
  - Partial updates via `PATCH /api/habits/:id` (whitelisted fields; client cannot modify `userId`, `archivedAt`, or completions).
  - Soft-archive/unarchive (`POST /api/habits/:id/archive`, `POST /api/habits/:id/unarchive`).
  - Hard delete (`DELETE /api/habits/:id`): cascades to delete all associated completion records.
- **Completions Tracking:**
  - Idempotent upsert (`PUT /api/habits/:id/completions/:date`): returns HTTP 201 when created, HTTP 200 when already completed.
  - Data-layer duplicate protection via compound unique index `{ habitId: 1, date: 1 }`.
  - Concurrency-safe (`findOneAndUpdate` with `upsert: true` and Mongo duplicate key error handling).
  - Date rules:
    - Rejects completions prior to habit `startDate`.
    - Rejects far-future dates beyond *UTC today + 1 day* (accommodates all world timezones including IST).
    - Rejects invalid calendar dates (e.g. `2026-02-30`).
  - Idempotent undo (`DELETE /api/habits/:id/completions/:date` returns HTTP 204).
  - Archived habits freeze history: mutations return `409 HABIT_ARCHIVED`, while completion history remains viewable.
- **Dashboard Statistics:**
  - Dynamic analytics over customizable time periods (`GET /api/dashboard/stats?from=YYYY-MM-DD&to=YYYY-MM-DD`, defaulting to the last 30 days).
  - Real metrics: `activeHabits`, `completionsThisWeek`, `completionsInPeriod`, `expectedCompletions`, `completionRate`, and `perHabit` breakdown.
  - Isolated from archived habits and handles mid-period habit start dates with consistent numerators and denominators.

---

## 3. Server Setup & Running

### Prerequisites
- Node.js >= 20.0.0
- npm >= 10.0.0
- A local MongoDB instance (`mongod`) or MongoDB Atlas connection string (Note: Server tests run entirely on `mongodb-memory-server` and require no local DB).

### Installation
```bash
# Clone repository and switch to working branch
git clone <repo-url> habit-tracker
cd habit-tracker

# Install server dependencies
cd server
npm install
```

### Environment Configuration
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Default configuration values:
```env
NODE_ENV=development
PORT=5000
MONGODB_URI=mongodb://localhost:27017/habit_tracker
JWT_ACCESS_SECRET=change-me-access
JWT_REFRESH_SECRET=change-me-refresh
ACCESS_TOKEN_TTL=15m
REFRESH_TOKEN_TTL_DAYS=7
BCRYPT_COST=10
```
*Note: `server/src/config/env.ts` validates all required variables at boot time and fails fast with actionable error messages if required variables are missing.*

### Running the Server
```bash
# Start server in development mode (hot reload with tsx watch)
npm run dev

# Lint codebase (ESLint 9 + TypeScript-ESLint)
npm run lint

# Typecheck codebase without emitting files
npm run typecheck

# Build server for production (compiles to server/dist/)
npm run build

# Start production build
npm start
```

---

## 4. Test Commands

All server tests are automated and execute using `mongodb-memory-server` without requiring a running MongoDB daemon:
```bash
cd server

# Run complete test suite (all unit and integration tests)
npm test
```
The test suite covers:
- S0: Server initialization, health check, Express hardening (`X-Powered-By` disabled)
- S1: Centralized error handling, AppError, 404 handler, async wrapper, rate limiter, env validation
- S2: Mongoose schemas, unique indexes, compound uniqueness, TTL expiration
- S3: Authentication, token generation, rotation, reuse detection, httpOnly cookie flags
- S4: Habits CRUD, status filtering, cascade deletion, ownership isolation (User B receives 404 on User A habits)
- S5: Completions idempotent upsert, undo, date range capping, future date tolerance, archived habit freezing
- S6: Pure expected completions logic, mid-period start dates, ISO week ranges, dynamic dashboard calculations
- S7: Full end-to-end user lifecycle flow, exhaustive cross-user ownership isolation, standard error shape guarantees
- S8: README and documentation accuracy verification

---

## 5. Architectural Decisions & Assumptions

### 1. Authentication & Session Split
- **Access Token:** Short-lived JWT (~15 minutes) returned in response bodies and held exclusively in client memory. Sent with requests via the `Authorization: Bearer <token>` header. Never persisted to `localStorage` or `sessionStorage` to mitigate token theft via XSS.
- **Refresh Token:** Cryptographically random 64-byte hex string (~7 days) stored exclusively in an `httpOnly`, `SameSite=Lax` cookie scoped to `path=/api/auth`. JavaScript cannot access this token.
- **Token Storage:** Only the SHA-256 hash of the refresh token is stored in MongoDB. Raw refresh tokens are never written to disk. A TTL index on `expiresAt` automatically cleans up expired entries.
- **Rotation & Reuse Detection:** Every refresh call invalidates the old token and issues a new pair. If an already-revoked refresh token is presented, the server revokes all sessions associated with that user account.

### 2. Date Handling
- All dates for habits and completions are stored and processed strictly as `YYYY-MM-DD` calendar strings (never timestamps).
- Date validation ensures strings correspond to real calendar days (e.g. `2026-02-30` is rejected).
- Future dates for completions are bounded by *UTC today + 1 day* (`getMaxAllowedCompletionDate()`) to accommodate international timezones (such as IST) without requiring per-user timezone configuration.

### 3. Ownership & Privacy
- Every database query for habits or completions enforces `{ _id, userId }`.
- Missing records, invalid ObjectId formats, and records owned by another user always return HTTP `404 NOT_FOUND` (never `403 FORBIDDEN`), preventing enumeration or probing of resource IDs.
- Request bodies are strictly whitelisted: clients can never modify `userId`, `archivedAt`, or `_id`.

### 4. Delete Behavior vs. Archiving
- **Hard Delete (`DELETE /api/habits/:id`):** Permanently removes the habit and cascades to delete all associated completion records in MongoDB.
- **Archiving (`POST /api/habits/:id/archive`):** Retains full historical data while freezing mutations (`409 HABIT_ARCHIVED`) and excluding the habit from active lists and dashboard analytics.

---

## 6. Dashboard Statistics Definition

Dashboard analytics (`GET /api/dashboard/stats`) are calculated according to the following rules:
- **Scope:** Active (non-archived) habits only (`archivedAt: null`).
- **Expected Completions (Denominator):** For each habit, the number of calendar days from `max(from, habit.startDate)` to `min(to, allowedMaxDate)` inclusive, where `allowedMaxDate` is UTC today + 1 day capped by `to`. If `effectiveStart > cappedEnd`, expected completions is 0.
- **Completions in Period (Numerator):** Only completions with `date` within `[max(from, habit.startDate), min(to, allowedMaxDate)]` are counted. This guarantees numerator and denominator consistency even if a habit's `startDate` was adjusted later.
- **Completion Rate:** `completionsInPeriod / expectedCompletions` (0 when expected is 0), rounded to 2 decimal places.
- **Completions This Week:** Completions recorded for active habits within the ISO week (Monday–Sunday) containing `to`.

---

## 7. Known Limitations

- **No Per-User Timezone:** The server stores date strings and applies a 1-day future tolerance (*UTC today + 1 day*) rather than storing per-user IANA timezone offsets.
- **Cookie CSRF Protection:** The refresh cookie relies on `SameSite=Lax` and path scoping (`/api/auth`) rather than anti-CSRF synchronizer tokens.
- **Reminders:** The habit model stores `reminderTime` (`HH:mm`), intended for client-side Notification APIs while the tab is open; no background email/SMS dispatch service is included.
- **Habit Frequency:** Daily frequency only (`DAILY`); weekly frequencies are reserved for future phases.

---

## 8. API Deviations from Base Contract

As documented in the requirements:
1. **Added Endpoints:**
   - `POST /api/auth/refresh`: Rotates refresh token cookies and issues new access tokens.
   - `GET /api/auth/me`: Retrieves current authenticated user profile.
   - `GET /api/health`: Health check endpoint.
2. **Authentication Flow:**
   - Auth responses (`signup`, `login`, `refresh`) return `{ user, accessToken }` in JSON body with the refresh token set via `httpOnly` cookie.
3. **Specific Error Codes:**
   - `409 HABIT_ARCHIVED`: Returned when attempting to create, update, or delete completions on an archived habit.
   - `429 RATE_LIMITED`: Returned when exceeding authentication rate limits.
4. **Additional Model Fields:**
   - `Habit.category` (string, max 30) and `Habit.reminderTime` (`HH:mm`) supported as optional attributes.

---

## 9. curl Examples

An executable bash script containing all curl commands is provided at `server/curl-examples.sh`.

```bash
# Run the complete curl test script against http://localhost:5000
chmod +x server/curl-examples.sh
./server/curl-examples.sh
```

### Quick Reference Commands

#### Health Check
```bash
curl -X GET http://localhost:5000/api/health
```

#### User Signup
```bash
curl -c cookies.txt -X POST http://localhost:5000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"firstName":"Jane","lastName":"Doe","email":"jane@example.com","password":"Password123"}'
```

#### User Login
```bash
curl -c cookies.txt -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"jane@example.com","password":"Password123"}'
```

#### Create Habit
```bash
curl -X POST http://localhost:5000/api/habits \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -d '{"name":"Morning Meditation","startDate":"2026-10-01","frequency":"DAILY"}'
```

#### Mark Habit Complete (Idempotent Upsert)
```bash
curl -X PUT http://localhost:5000/api/habits/<HABIT_ID>/completions/2026-10-30 \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Get Dashboard Stats
```bash
curl -X GET "http://localhost:5000/api/dashboard/stats?from=2026-10-01&to=2026-10-30" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

#### Refresh Token Rotation
```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/refresh
```

#### Logout
```bash
curl -b cookies.txt -c cookies.txt -X POST http://localhost:5000/api/auth/logout
```
