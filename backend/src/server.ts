import http from 'node:http';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './config/db.js';
import { createApp } from './app.js';
import { initSocketIO } from './services/socketService.js';

async function bootstrap() {
  await connectDatabase();
  console.log('Connected to MongoDB');

  const app = createApp();
  const server = http.createServer(app);
  initSocketIO(server);

  server.listen(env.PORT, () => {
    console.log(`Common Ground API listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async () => {
    server.close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

bootstrap().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
