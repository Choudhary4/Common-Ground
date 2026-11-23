import { Router } from 'express';
import { z } from 'zod';
import { User, Hostel, HostelQR, AccessCode, AnalyticsEvent } from '../models/index.js';
import { verifyPassword, hashToken, hashAccessCode } from '../utils/crypto.js';
import { authenticate } from '../middleware/auth.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { createSessionAndSetCookie, revokeSessionAndClearCookie } from '../services/sessionService.js';
import { recordAuditLog } from '../services/auditService.js';
import { emitToHostel } from '../services/socketService.js';

const router = Router();

const travellerOnboardSchema = z.object({
  qrToken: z.string().min(10),
  nickname: z.string().trim().min(2, 'Nickname must be at least 2 characters').max(40),
  accessCode: z.string().trim().min(4, 'Access code is required').max(20),
  interests: z.array(z.string().trim().min(1).max(24)).max(5).optional(),
});

router.post('/traveller/onboard', authRateLimiter, async (req, res, next) => {
  try {
    const { qrToken, nickname, accessCode, interests } = travellerOnboardSchema.parse(req.body);

    const qr = await HostelQR.findOne({ tokenHash: hashToken(qrToken), status: 'ACTIVE' });
    if (!qr) {
      res.status(404).json({ error: 'This hostel QR code is invalid or revoked.' });
      return;
    }

    const hostel = await Hostel.findOne({ _id: qr.hostelId, status: 'ACTIVE' });
    if (!hostel) {
      res.status(404).json({ error: 'Hostel is currently unavailable.' });
      return;
    }

    const now = new Date();
    const validCode = await AccessCode.findOne({
      hostelId: hostel._id,
      codeHash: hashAccessCode(accessCode),
      status: 'ACTIVE',
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
    });

    if (!validCode) {
      res.status(401).json({ error: 'Invalid or expired hostel access code.' });
      return;
    }

    const user = await User.create({
      nickname,
      role: 'TRAVELLER',
      hostelId: hostel._id,
      interests: interests ?? [],
      isDemo: hostel.isDemo,
    });

    const { expiresAt } = await createSessionAndSetCookie(res, user._id, hostel._id);

    await AnalyticsEvent.create({
      hostelId: hostel._id,
      userId: user._id,
      eventType: 'TRAVELLER_ONBOARDED',
      isDemo: hostel.isDemo,
    });

    emitToHostel(hostel._id.toString(), 'social:updated', { hostelId: hostel._id.toString() });

    res.status(201).json({
      user: {
        id: user._id,
        nickname: user.nickname,
        role: user.role,
        hostelId: hostel._id,
        hostelName: hostel.name,
        hostelCity: hostel.city,
        interests: user.interests,
      },
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

const staffLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/staff/login', authRateLimiter, async (req, res, next) => {
  try {
    const { email, password } = staffLoginSchema.parse(req.body);
    const user = await User.findOne({
      email: email.toLowerCase(),
      role: { $in: ['CENTRAL_ADMIN', 'HOSTEL_MANAGER', 'HOSTEL_STAFF'] },
    }).select('+passwordHash');

    if (!user || !user.passwordHash) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Account is disabled or restricted' });
      return;
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const { expiresAt } = await createSessionAndSetCookie(res, user._id, user.hostelId);
    await recordAuditLog({
      actorId: user._id,
      actorRole: user.role,
      hostelId: user.hostelId,
      action: 'STAFF_LOGIN',
      targetType: 'User',
      targetId: user._id.toString(),
    });

    const hostel = user.hostelId ? await Hostel.findById(user.hostelId).lean() : null;

    res.json({
      user: {
        id: user._id,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        hostelId: user.hostelId,
        hostelName: hostel?.name ?? null,
      },
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const user = await User.findById(req.auth!.userId).lean();
    if (!user) {
      res.status(401).json({ error: 'User not found' });
      return;
    }
    const hostel = user.hostelId ? await Hostel.findById(user.hostelId).lean() : null;
    res.json({
      user: {
        id: user._id,
        nickname: user.nickname,
        email: user.email ?? null,
        role: user.role,
        hostelId: user.hostelId,
        hostelName: hostel?.name ?? null,
        hostelCity: hostel?.city ?? null,
        avatar: user.avatar ?? null,
        interests: user.interests ?? [],
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', authenticate, async (req, res, next) => {
  try {
    await revokeSessionAndClearCookie(res, req.auth!.sessionId);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    next(err);
  }
});

export default router;
