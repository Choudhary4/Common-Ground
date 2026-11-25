import { Router } from 'express';
import { z } from 'zod';
import { User, Hostel, HostelQR, AccessCode, AnalyticsEvent } from '../models/index.js';
import { verifyPassword, hashPassword, hashToken, hashAccessCode } from '../utils/crypto.js';
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
  avatar: z.string().trim().max(300).nullable().optional(),
  interests: z.array(z.string().trim().min(1).max(24)).max(5).optional(),
});

router.post('/traveller/onboard', authRateLimiter, async (req, res, next) => {
  try {
    const { qrToken, nickname, accessCode, avatar, interests } = travellerOnboardSchema.parse(req.body);

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
      avatar: avatar ?? null,
      role: 'TRAVELLER',
      hostelId: hostel._id,
      interests: interests ?? [],
      isDemo: hostel.isDemo,
    });

    const { expiresAt, token: sessionToken } = await createSessionAndSetCookie(res, user._id, hostel._id);

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
        avatar: user.avatar ?? null,
        role: user.role,
        hostelId: hostel._id,
        hostelName: hostel.name,
        hostelCity: hostel.city,
        interests: user.interests,
      },
      sessionToken,
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

    const { expiresAt, token: sessionToken } = await createSessionAndSetCookie(res, user._id, user.hostelId);
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
      sessionToken,
      expiresAt,
    });
  } catch (err) {
    next(err);
  }
});

const staffRegisterSchema = z.object({
  nickname: z.string().trim().min(2, 'Name must be at least 2 characters').max(40),
  email: z.string().trim().email('Valid email is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  hostelName: z.string().trim().min(2, 'Hostel / space name is required').max(120),
  city: z.string().trim().min(2, 'City is required').max(80),
  address: z.string().trim().max(250).optional(),
});

router.post('/staff/register', authRateLimiter, async (req, res, next) => {
  try {
    const data = staffRegisterSchema.parse(req.body);
    const normalizedEmail = data.email.toLowerCase();

    const existing = await User.findOne({ email: normalizedEmail }).lean();
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists' });
      return;
    }

    const baseSlug = `${data.hostelName}-${data.city}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    const slugExists = await Hostel.findOne({ slug: baseSlug }).lean();
    const slug = slugExists ? `${baseSlug}-${Date.now().toString(36)}` : baseSlug;

    const hostel = await Hostel.create({
      name: data.hostelName,
      city: data.city,
      address: data.address?.trim() || data.city,
      slug,
      status: 'ACTIVE',
      isDemo: false,
    });

    const passwordHash = await hashPassword(data.password);
    const user = await User.create({
      nickname: data.nickname,
      email: normalizedEmail,
      passwordHash,
      role: 'HOSTEL_MANAGER',
      hostelId: hostel._id,
      status: 'ACTIVE',
      isDemo: false,
    });

    const { expiresAt, token: sessionToken } = await createSessionAndSetCookie(
      res,
      user._id,
      hostel._id
    );

    await recordAuditLog({
      actorId: user._id,
      actorRole: user.role,
      hostelId: hostel._id,
      action: 'HOSTEL_AND_MANAGER_SELF_REGISTERED',
      targetType: 'Hostel',
      targetId: hostel._id.toString(),
    });

    res.status(201).json({
      user: {
        id: user._id,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        hostelId: hostel._id,
        hostelName: hostel.name,
        hostelCity: hostel.city,
      },
      sessionToken,
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
