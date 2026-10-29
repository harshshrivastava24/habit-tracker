import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';

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

export default app;
