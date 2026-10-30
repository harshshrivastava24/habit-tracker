import app from './app.js';
import { env } from './config/env.js';
import { connectDB } from './config/db.js';

export const startServer = async () => {
  try {
    await connectDB(env.MONGODB_URI);
    console.log(`Connected to MongoDB at ${env.MONGODB_URI}`);

    const server = app.listen(env.PORT, () => {
      console.log(`Server listening on port ${env.PORT} in ${env.NODE_ENV} mode`);
    });

    return server;
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}
