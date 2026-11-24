import type { Response } from 'express';
import type { Types } from 'mongoose';
import { Session } from '../models/index.js';
import { env } from '../config/env.js';
import { generateSecureToken, hashToken } from '../utils/crypto.js';
import { SESSION_COOKIE_NAME } from '../middleware/auth.js';

export async function createSessionAndSetCookie(
  res: Response,
  userId: Types.ObjectId,
  hostelId: Types.ObjectId | null
): Promise<{ expiresAt: Date; token: string }> {
  const rawToken = generateSecureToken(32);
  const tokenHash = hashToken(rawToken);
  const expiresAt = new Date(Date.now() + env.SESSION_TTL_HOURS * 60 * 60 * 1000);

  await Session.create({
    userId,
    hostelId,
    tokenHash,
    expiresAt,
  });

  res.cookie(SESSION_COOKIE_NAME, rawToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    expires: expiresAt,
    path: '/',
  });

  return { expiresAt, token: rawToken };
}

export async function revokeSessionAndClearCookie(
  res: Response,
  sessionId: Types.ObjectId
): Promise<void> {
  await Session.updateOne({ _id: sessionId }, { $set: { revokedAt: new Date() } });
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: env.NODE_ENV === 'production' ? 'none' : 'lax',
    path: '/',
  });
}
