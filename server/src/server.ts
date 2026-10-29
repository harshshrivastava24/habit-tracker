import app from './app.js';

// Load .env if present in Node 20.6+
if (typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile();
  } catch {
    // If .env is not found, continue with existing process.env
  }
}

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 5000;

app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
