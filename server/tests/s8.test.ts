import { describe, it, expect } from 'vitest';
import request from 'supertest';
import fs from 'node:fs';
import path from 'node:path';
import app from '../src/app.js';
import packageJson from '../package.json' with { type: 'json' };

describe('Phase S8 Documentation & Setup Integrity', () => {
  const rootReadmePath = path.resolve(__dirname, '../../README.md');
  const serverReadmePath = path.resolve(__dirname, '../README.md');
  const envExamplePath = path.resolve(__dirname, '../.env.example');

  it('Gate: root README.md exists and covers all required PRD Section 13 criteria', () => {
    expect(fs.existsSync(rootReadmePath)).toBe(true);
    const content = fs.readFileSync(rootReadmePath, 'utf-8');

    // Track
    expect(content).toMatch(/Track/i);
    expect(content).toMatch(/Full-stack/i);

    // Features
    expect(content).toMatch(/## 2\.\s*Features/i);
    expect(content).toMatch(/Authentication/i);
    expect(content).toMatch(/Habits/i);
    expect(content).toMatch(/Completions/i);
    expect(content).toMatch(/Dashboard/i);

    // Setup & Running
    expect(content).toMatch(/## 3\.\s*Server Setup/i);
    expect(content).toMatch(/npm install/i);
    expect(content).toMatch(/npm run dev/i);

    // Environment Variables
    expect(content).toMatch(/JWT_ACCESS_SECRET/);
    expect(content).toMatch(/MONGODB_URI/);

    // Test Commands
    expect(content).toMatch(/npm test/i);

    // Assumptions & Auth Choice
    expect(content).toMatch(/Architectural Decisions/i);
    expect(content).toMatch(/httpOnly/i);
    expect(content).toMatch(/Bearer/i);

    // Delete Behavior
    expect(content).toMatch(/Hard Delete/i);
    expect(content).toMatch(/Archiving/i);

    // Stats Definition
    expect(content).toMatch(/Dashboard Statistics Definition/i);
    expect(content).toMatch(/Expected Completions/i);
    expect(content).toMatch(/Completion Rate/i);

    // Known Limitations
    expect(content).toMatch(/Known Limitations/i);
    expect(content).toMatch(/no per-user timezone/i);
    expect(content).toMatch(/SameSite/i);

    // API Deviations
    expect(content).toMatch(/API Deviations/i);
    expect(content).toMatch(/HABIT_ARCHIVED/i);

    // curl Examples
    expect(content).toMatch(/curl Examples/i);
  });

  it('server/README.md exists and contains server quick start instructions', () => {
    expect(fs.existsSync(serverReadmePath)).toBe(true);
    const content = fs.readFileSync(serverReadmePath, 'utf-8');
    expect(content).toMatch(/npm install/i);
    expect(content).toMatch(/npm run dev/i);
    expect(content).toMatch(/npm test/i);
    expect(content).toMatch(/npm run build/i);
  });

  it('package.json contains all scripts referenced in README', () => {
    const scripts = packageJson.scripts as Record<string, string>;
    expect(scripts.dev).toBeDefined();
    expect(scripts.build).toBeDefined();
    expect(scripts.start).toBeDefined();
    expect(scripts.test).toBeDefined();
    expect(scripts.lint).toBeDefined();
    expect(scripts.typecheck).toBeDefined();
  });

  it('.env.example contains all required environment variables', () => {
    expect(fs.existsSync(envExamplePath)).toBe(true);
    const content = fs.readFileSync(envExamplePath, 'utf-8');
    expect(content).toContain('PORT');
    expect(content).toContain('MONGODB_URI');
    expect(content).toContain('JWT_ACCESS_SECRET');
    expect(content).toContain('JWT_REFRESH_SECRET');
    expect(content).toContain('ACCESS_TOKEN_TTL');
    expect(content).toContain('REFRESH_TOKEN_TTL_DAYS');
    expect(content).toContain('BCRYPT_COST');
  });

  it('Gate: Server setup works exactly as written (/health endpoint responds 200 { status: "ok" })', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});
