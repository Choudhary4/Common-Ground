import type { Server as HttpServer } from 'node:http';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { Session, User } from '../models/index.js';
import { hashToken } from '../utils/crypto.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

let io: SocketIOServer | null = null;
const onlineCountsByHostel = new Map<string, Map<string, number>>();

export function getOnlineUserIds(hostelId: string): string[] {
  const hostelMap = onlineCountsByHostel.get(hostelId);
  if (!hostelMap) return [];
  return [...hostelMap.keys()];
}

export function isUserOnline(hostelId: string, userId: string): boolean {
  const hostelMap = onlineCountsByHostel.get(hostelId);
  return Boolean(hostelMap && (hostelMap.get(userId) ?? 0) > 0);
}

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
  const allowedOrigins = env.FRONTEND_URL.split(',').map((u) => u.trim().replace(/\/+$/, ''));
  io = new SocketIOServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const cookies = parseCookies(socket.handshake.headers.cookie);
      const authToken =
        typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
      const rawToken = cookies[SESSION_COOKIE_NAME] || authToken;
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
    if (hostelId) {
      socket.join(`hostel:${hostelId}`);
      if (userId) {
        let hostelMap = onlineCountsByHostel.get(hostelId);
        if (!hostelMap) {
          hostelMap = new Map();
          onlineCountsByHostel.set(hostelId, hostelMap);
        }
        const prev = hostelMap.get(userId) ?? 0;
        hostelMap.set(userId, prev + 1);
        if (prev === 0) {
          io?.to(`hostel:${hostelId}`).emit('presence:update', { userId, online: true });
        }
      }
      socket.emit('presence:list', { onlineUserIds: getOnlineUserIds(hostelId) });
    }

    socket.on('disconnect', () => {
      if (hostelId && userId) {
        const hostelMap = onlineCountsByHostel.get(hostelId);
        if (hostelMap) {
          const next = (hostelMap.get(userId) ?? 1) - 1;
          if (next <= 0) {
            hostelMap.delete(userId);
            io?.to(`hostel:${hostelId}`).emit('presence:update', { userId, online: false });
          } else {
            hostelMap.set(userId, next);
          }
        }
      }
    });
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
