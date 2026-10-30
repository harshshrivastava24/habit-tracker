import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRouter from './routes/auth.js';
import habitRouter from './routes/habits.js';
import dashboardRouter from './routes/dashboard.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import { env } from './config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

// Hardening as specified in PRD section 2
app.disable('x-powered-by');

// Behind reverse proxy (e.g. Render) for secure cookies and rate-limiting
app.set('trust proxy', 1);

// Middleware
app.use(express.json());
app.use(cookieParser());

// Health check endpoint (PRD section 7.1 & 11)
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// API routes (PRD section 7)
app.use('/api/auth', authRouter);
app.use('/api/habits', habitRouter);
app.use('/api/dashboard', dashboardRouter);

// In production, serve the built client
if (env.NODE_ENV === 'production') {
  const clientDistPath = path.resolve(__dirname, '../../client/dist');
  const clientIndexPath = path.resolve(clientDistPath, 'index.html');

  // Serve static assets from client/dist
  app.use(express.static(clientDistPath));

  // Fallback that returns client/dist/index.html for any non-/api GET route
  app.get('*', (req: Request, res: Response, next) => {
    if (req.path.startsWith('/api')) {
      return next();
    }
    res.sendFile(clientIndexPath);
  });
}

// 404 handler for unknown routes
app.use(notFound);

// Central error handler
app.use(errorHandler);

export default app;
