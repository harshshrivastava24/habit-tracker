import express, { Request, Response } from 'express';
import cookieParser from 'cookie-parser';

const app = express();

app.disable('x-powered-by');

app.use(express.json());
app.use(cookieParser());

const healthHandler = (_req: Request, res: Response) => {
  res.status(200).json({ status: 'ok' });
};

app.get('/health', healthHandler);
app.get('/api/health', healthHandler);

export default app;

