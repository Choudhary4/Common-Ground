import { Router } from 'express';
import QRCode from 'qrcode';
import { Hostel, HostelQR, AccessCode, Session, Activity } from '../models/index.js';
import { env } from '../config/env.js';
import { authenticate } from '../middleware/auth.js';
import { requireHostelScope, requireRole } from '../middleware/rbac.js';
import {
  generateSecureToken,
  hashToken,
  encryptSecret,
  decryptSecret,
  generateAccessCode,
  hashAccessCode,
} from '../utils/crypto.js';
import { recordAuditLog } from '../services/auditService.js';

const router = Router();
router.use(authenticate, requireHostelScope, requireRole('HOSTEL_STAFF', 'HOSTEL_MANAGER'));

async function buildQrPayload(
  hostelId: import('mongoose').Types.ObjectId,
  qr: { _id: unknown; tokenEncrypted: string; scanCount: number; createdAt: Date }
) {
  const rawToken = decryptSecret(qr.tokenEncrypted);
  const activeCode = await AccessCode.findOne({ hostelId, status: 'ACTIVE' }).lean();
  const baseUrl = `${env.QR_BASE_URL.replace(/\/$/, '')}/${rawToken}`;
  const qrUrl = activeCode
    ? `${baseUrl}?code=${encodeURIComponent(decryptSecret(activeCode.codeEncrypted))}`
    : baseUrl;
  const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 400, margin: 2 });
  return {
    id: qr._id,
    qrUrl,
    qrDataUrl,
    scanCount: qr.scanCount,
    createdAt: qr.createdAt,
  };
}

router.get('/overview', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const now = new Date();

    const [hostel, activeSessions, activeActivities, activeQr, activeCode] = await Promise.all([
      Hostel.findById(hostelId).lean(),
      Session.countDocuments({ hostelId, revokedAt: null, expiresAt: { $gt: now } }),
      Activity.countDocuments({ hostelId, status: { $in: ['OPEN', 'FULL'] } }),
      HostelQR.findOne({ hostelId, status: 'ACTIVE' }).lean(),
      AccessCode.findOne({ hostelId, status: 'ACTIVE' }).lean(),
    ]);

    res.json({
      hostelName: hostel?.name ?? 'Hostel',
      hostelCity: hostel?.city ?? '',
      activeTravellersCount: activeSessions,
      activeActivitiesCount: activeActivities,
      qrStatus: activeQr ? 'ACTIVE' : 'NONE',
      accessCodeStatus: activeCode ? 'ACTIVE' : 'NONE',
    });
  } catch (err) {
    next(err);
  }
});

router.get('/qr', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const activeQr = await HostelQR.findOne({ hostelId, status: 'ACTIVE' }).lean();
    if (!activeQr) {
      res.json({ qr: null });
      return;
    }
    const payload = await buildQrPayload(hostelId, activeQr);
    res.json({ qr: payload });
  } catch (err) {
    next(err);
  }
});

router.post('/qr/generate', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const now = new Date();

    await HostelQR.updateMany(
      { hostelId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: now } }
    );

    // Ensure an active access code exists so the generated QR embeds it automatically
    const existingCode = await AccessCode.findOne({ hostelId, status: 'ACTIVE' }).lean();
    if (!existingCode) {
      const rawCode = generateAccessCode(6);
      await AccessCode.create({
        hostelId,
        codeHash: hashAccessCode(rawCode),
        codeEncrypted: encryptSecret(rawCode),
        status: 'ACTIVE',
        createdBy: req.auth!.userId,
      });
    }

    const rawToken = generateSecureToken(24);
    const qr = await HostelQR.create({
      hostelId,
      tokenHash: hashToken(rawToken),
      tokenEncrypted: encryptSecret(rawToken),
      status: 'ACTIVE',
      createdBy: req.auth!.userId,
    });

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId,
      action: 'QR_GENERATED',
      targetType: 'HostelQR',
      targetId: qr._id.toString(),
    });

    const payload = await buildQrPayload(hostelId, qr);
    res.status(201).json({ qr: payload });
  } catch (err) {
    next(err);
  }
});

router.post('/qr/revoke', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    await HostelQR.updateMany(
      { hostelId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED', revokedAt: new Date() } }
    );

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId,
      action: 'QR_REVOKED',
      targetType: 'HostelQR',
    });

    res.json({ message: 'QR code revoked' });
  } catch (err) {
    next(err);
  }
});

router.get('/access-code', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    const activeCode = await AccessCode.findOne({ hostelId, status: 'ACTIVE' }).lean();
    if (!activeCode) {
      res.json({ accessCode: null });
      return;
    }

    res.json({
      accessCode: {
        id: activeCode._id,
        code: decryptSecret(activeCode.codeEncrypted),
        status: activeCode.status,
        createdAt: activeCode.createdAt,
        expiresAt: activeCode.expiresAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/access-code/regenerate', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    await AccessCode.updateMany(
      { hostelId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED' } }
    );

    const rawCode = generateAccessCode(6);
    const created = await AccessCode.create({
      hostelId,
      codeHash: hashAccessCode(rawCode),
      codeEncrypted: encryptSecret(rawCode),
      status: 'ACTIVE',
      createdBy: req.auth!.userId,
    });

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId,
      action: 'ACCESS_CODE_REGENERATED',
      targetType: 'AccessCode',
      targetId: created._id.toString(),
    });

    res.status(201).json({
      accessCode: {
        id: created._id,
        code: rawCode,
        status: created.status,
        createdAt: created.createdAt,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post('/access-code/revoke', async (req, res, next) => {
  try {
    const hostelId = req.auth!.hostelId!;
    await AccessCode.updateMany(
      { hostelId, status: 'ACTIVE' },
      { $set: { status: 'REVOKED' } }
    );

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId,
      action: 'ACCESS_CODE_REVOKED',
      targetType: 'AccessCode',
    });

    res.json({ message: 'Access code revoked' });
  } catch (err) {
    next(err);
  }
});

export default router;
