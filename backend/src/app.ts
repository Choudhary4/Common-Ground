import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { generalRateLimiter } from './middleware/rateLimit.js';
import { errorHandler } from './middleware/errorHandler.js';
import authRoutes from './routes/authRoutes.js';
import qrRoutes from './routes/qrRoutes.js';
import travellerRoutes from './routes/travellerRoutes.js';
import activityRoutes from './routes/activityRoutes.js';
import staffRoutes from './routes/staffRoutes.js';
import managerRoutes from './routes/managerRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

export function createApp() {
  const app = express();

  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(
    cors({
      origin: env.FRONTEND_URL,
      credentials: true,
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser(env.COOKIE_SECRET));
  app.use('/api', generalRateLimiter);

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'common-ground-api', timestamp: new Date().toISOString() });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/qr', qrRoutes);
  app.use('/api/traveller', travellerRoutes);
  app.use('/api/activities', activityRoutes);
  app.use('/api/staff', staffRoutes);
  app.use('/api/manager', managerRoutes);
  app.use('/api/admin', adminRoutes);

  app.use(errorHandler);
  return app;
}
