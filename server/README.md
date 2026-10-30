# Habit Tracker – Server

Express 4 + TypeScript + MongoDB backend for the Habit Tracker application.

## Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment
```bash
cp .env.example .env
```
Ensure your `.env` contains valid values for:
- `PORT` (default: 5000)
- `MONGODB_URI`
- `JWT_ACCESS_SECRET`
- `JWT_REFRESH_SECRET`
- `ACCESS_TOKEN_TTL` (default: 15m)
- `REFRESH_TOKEN_TTL_DAYS` (default: 7)
- `BCRYPT_COST` (default: 10)

### 3. Run Development Server
```bash
npm run dev
```

### 4. Run Tests
```bash
npm test
```
All tests run with `mongodb-memory-server` and require no local database.

### 5. Build for Production
```bash
npm run build
npm start
```

### 6. curl Verification
An end-to-end curl script is provided in `curl-examples.sh`:
```bash
chmod +x curl-examples.sh
./curl-examples.sh
```

For full documentation on data models, ownership rules, statistics definitions, and known limitations, see the root [`README.md`](../README.md).

