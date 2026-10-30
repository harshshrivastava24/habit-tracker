import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';
import authRouter from './routes/auth.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';

const app = express();

// Hardening as specified in PRD section 2
app.disable('x-powered-by');

// Middleware
app.use(express.json());
app.use(cookieParser());

// Health check endpoint (PRD section 7.1 & 11)
const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

// Auth routes (PRD section 7.1 & 11)
app.use('/api/auth', authRouter);
app.use('/auth', authRouter);

// 404 handler for unknown routes
app.use(notFound);

// Central error handler
app.use(errorHandler);

export default app;
