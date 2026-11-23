import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { Session, User } from '../models/index.js';
import { hashToken } from '../utils/crypto.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

let io: SocketIOServer | null = null;

function parseCookies(cookieHeader: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!cookieHeader) return result;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx > -1) {
      const key = part.slice(0, idx).trim();
      const val = decodeURIComponent(part.slice(idx + 1).trim());
      result[key] = val;
    }
  }
  return result;
}

export function initSocketIO(httpServer: HttpServer): SocketIOServer {
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: env.FRONTEND_URL,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const rawToken = cookies[SESSION_COOKIE_NAME];
      if (!rawToken) return next(new Error('Unauthorized'));

      const session = await Session.findOne({
        tokenHash: hashToken(rawToken),
        revokedAt: null,
        expiresAt: { $gt: new Date() },
      });
      if (!session) return next(new Error('Session expired'));

      const user = await User.findById(session.userId);
      if (!user || user.status !== 'ACTIVE') return next(new Error('Forbidden'));

      socket.data.userId = user._id.toString();
      socket.data.hostelId = user.hostelId ? user.hostelId.toString() : null;
      socket.data.role = user.role;
      next();
    } catch {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    const { userId, hostelId } = socket.data;
    if (userId) socket.join(`user:${userId}`);
    if (hostelId) socket.join(`hostel:${hostelId}`);
  });

  return io;
}

export function emitToHostel(hostelId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`hostel:${hostelId}`).emit(event, payload);
}

export function emitToUser(userId: string, event: string, payload: unknown): void {
  if (!io) return;
  io.to(`user:${userId}`).emit(event, payload);
}
