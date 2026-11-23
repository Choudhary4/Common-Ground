import type { Request, Response, NextFunction } from 'express';
import type { Types } from 'mongoose';
import { Session, User, type UserRole } from '../models/index.js';
import { hashToken } from '../utils/crypto.js';

export const SESSION_COOKIE_NAME = 'cg_session';

export interface AuthContext {
  sessionId: Types.ObjectId;
  userId: Types.ObjectId;
  role: UserRole;
  hostelId: Types.ObjectId | null;
  nickname: string;
  isDemo: boolean;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthContext;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const rawToken = req.cookies?.[SESSION_COOKIE_NAME];
    if (!rawToken || typeof rawToken !== 'string') {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    const tokenHash = hashToken(rawToken);
    const now = new Date();

    const session = await Session.findOne({
      tokenHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    });

    if (!session) {
      res.status(401).json({ error: 'Session expired or invalid' });
      return;
    }

    const user = await User.findById(session.userId);
    if (!user || user.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Account is restricted or disabled' });
      return;
    }

    // Update lastActiveAt asynchronously without blocking request
    void Session.updateOne({ _id: session._id }, { $set: { lastActiveAt: now } });

    req.auth = {
      sessionId: session._id,
      userId: user._id,
      role: user.role,
      hostelId: user.hostelId,
      nickname: user.nickname,
      isDemo: user.isDemo,
    };

    next();
  } catch (err) {
    next(err);
  }
}
