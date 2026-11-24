import { Router } from 'express';
import { z } from 'zod';
import { Types } from 'mongoose';
import { Hostel, User, Activity, AnalyticsEvent, AuditLog } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { hashPassword } from '../utils/crypto.js';
import { recordAuditLog } from '../services/auditService.js';

const router = Router();
router.use(authenticate, requireRole('CENTRAL_ADMIN'));

router.get('/overview', async (_req, res, next) => {
  try {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    const [
      hostels,
      hostelCount,
      managerCount,
      staffCount,
      realTravellers,
      realActivities,
      events,
      perHostelEvents,
      perHostelTravellers,
      thisWeekEvents,
      lastWeekEvents,
    ] = await Promise.all([
      Hostel.find().select('_id name city status isDemo').lean(),
      Hostel.countDocuments({ status: 'ACTIVE' }),
      User.countDocuments({ role: 'HOSTEL_MANAGER', status: 'ACTIVE' }),
      User.countDocuments({ role: 'HOSTEL_STAFF', status: 'ACTIVE' }),
      User.countDocuments({ role: 'TRAVELLER', isDemo: false }),
      Activity.countDocuments({ isDemo: false }),
      AnalyticsEvent.aggregate([
        { $match: { isDemo: false } },
        { $group: { _id: '$eventType', count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { isDemo: false } },
        { $group: { _id: { hostelId: '$hostelId', eventType: '$eventType' }, count: { $sum: 1 } } },
      ]),
      User.aggregate([
        { $match: { role: 'TRAVELLER', isDemo: false, hostelId: { $ne: null } } },
        { $group: { _id: '$hostelId', count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { isDemo: false, createdAt: { $gte: sevenDaysAgo } } },
        { $group: { _id: '$hostelId', count: { $sum: 1 } } },
      ]),
      AnalyticsEvent.aggregate([
        { $match: { isDemo: false, createdAt: { $gte: fourteenDaysAgo, $lt: sevenDaysAgo } } },
        { $group: { _id: '$hostelId', count: { $sum: 1 } } },
      ]),
    ]);

    const eventCounts: Record<string, number> = {};
    for (const e of events) eventCounts[e._id] = e.count;

    const travellerMap = new Map(perHostelTravellers.map((t) => [t._id.toString(), t.count as number]));
    const thisWeekMap = new Map(
      thisWeekEvents.filter((e) => e._id).map((e) => [e._id.toString(), e.count as number])
    );
    const lastWeekMap = new Map(
      lastWeekEvents.filter((e) => e._id).map((e) => [e._id.toString(), e.count as number])
    );
    const hostelEventMap = new Map<string, Record<string, number>>();
    for (const item of perHostelEvents) {
      const hId = item._id.hostelId?.toString();
      if (!hId) continue;
      if (!hostelEventMap.has(hId)) hostelEventMap.set(hId, {});
      hostelEventMap.get(hId)![item._id.eventType] = item.count;
    }

    const hostelBreakdown = hostels.map((h) => {
      const hid = h._id.toString();
      const ev = hostelEventMap.get(hid) ?? {};
      return {
        hostelId: h._id,
        name: h.name,
        city: h.city,
        status: h.status,
        isDemo: h.isDemo,
        qrScans: ev.QR_SCAN ?? 0,
        travellersOnboarded: travellerMap.get(hid) ?? 0,
        activitiesCreated: ev.ACTIVITY_CREATED ?? 0,
        activitiesJoined: ev.ACTIVITY_JOINED ?? 0,
        activitiesCompleted: ev.ACTIVITY_COMPLETED ?? 0,
        thisWeekEvents: thisWeekMap.get(hid) ?? 0,
        lastWeekEvents: lastWeekMap.get(hid) ?? 0,
      };
    });

    res.json({
      activeHostels: hostelCount,
      managers: managerCount,
      staff: staffCount,
      realMetrics: {
        travellersOnboarded: realTravellers,
        activitiesCreated: realActivities,
        qrScans: eventCounts.QR_SCAN ?? 0,
        activitiesJoined: eventCounts.ACTIVITY_JOINED ?? 0,
        activitiesCompleted: eventCounts.ACTIVITY_COMPLETED ?? 0,
      },
      hostelBreakdown,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/hostels', async (_req, res, next) => {
  try {
    const hostels = await Hostel.find().sort({ createdAt: -1 }).lean();
    res.json({ hostels });
  } catch (err) {
    next(err);
  }
});

const createHostelSchema = z.object({
  name: z.string().trim().min(2).max(120),
  city: z.string().trim().min(2).max(80),
  address: z.string().trim().min(4).max(250),
});

router.post('/hostels', async (req, res, next) => {
  try {
    const data = createHostelSchema.parse(req.body);
    const slug = `${data.name}-${data.city}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');

    const existing = await Hostel.findOne({ slug }).lean();
    const finalSlug = existing ? `${slug}-${Date.now().toString(36)}` : slug;

    const hostel = await Hostel.create({
      ...data,
      slug: finalSlug,
      status: 'ACTIVE',
      isDemo: false,
    });

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId: hostel._id,
      action: 'HOSTEL_CREATED',
      targetType: 'Hostel',
      targetId: hostel._id.toString(),
    });

    res.status(201).json({ hostel });
  } catch (err) {
    next(err);
  }
});

router.patch('/hostels/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        name: z.string().trim().min(2).max(120).optional(),
        city: z.string().trim().min(2).max(80).optional(),
        address: z.string().trim().min(4).max(250).optional(),
        status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
      })
      .parse(req.body);

    const hostel = await Hostel.findByIdAndUpdate(req.params.id, { $set: data }, { new: true });
    if (!hostel) {
      res.status(404).json({ error: 'Hostel not found' });
      return;
    }
    res.json({ hostel });
  } catch (err) {
    next(err);
  }
});

router.get('/staff', async (_req, res, next) => {
  try {
    const staff = await User.find({
      role: { $in: ['HOSTEL_MANAGER', 'HOSTEL_STAFF'] },
    })
      .sort({ createdAt: -1 })
      .lean();

    const hostels = await Hostel.find().select('_id name').lean();
    const hMap = new Map(hostels.map((h) => [h._id.toString(), h.name]));

    res.json({
      staff: staff.map((s) => ({
        id: s._id,
        nickname: s.nickname,
        email: s.email,
        role: s.role,
        hostelId: s.hostelId,
        hostelName: s.hostelId ? (hMap.get(s.hostelId.toString()) ?? 'Unknown') : null,
        status: s.status,
        createdAt: s.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const createStaffSchema = z.object({
  nickname: z.string().trim().min(2).max(40),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['HOSTEL_MANAGER', 'HOSTEL_STAFF']),
  hostelId: z.string().min(1),
});

router.post('/staff', async (req, res, next) => {
  try {
    const data = createStaffSchema.parse(req.body);
    const hostel = await Hostel.findById(data.hostelId).lean();
    if (!hostel) {
      res.status(404).json({ error: 'Hostel not found' });
      return;
    }

    const existing = await User.findOne({ email: data.email.toLowerCase() }).lean();
    if (existing) {
      res.status(409).json({ error: 'Email is already registered' });
      return;
    }

    const passwordHash = await hashPassword(data.password);
    const user = await User.create({
      nickname: data.nickname,
      email: data.email.toLowerCase(),
      passwordHash,
      role: data.role,
      hostelId: new Types.ObjectId(data.hostelId),
      status: 'ACTIVE',
      isDemo: false,
    });

    await recordAuditLog({
      actorId: req.auth!.userId,
      actorRole: req.auth!.role,
      hostelId: hostel._id,
      action: 'STAFF_CREATED',
      targetType: 'User',
      targetId: user._id.toString(),
      metadata: { role: data.role },
    });

    res.status(201).json({
      staff: {
        id: user._id,
        nickname: user.nickname,
        email: user.email,
        role: user.role,
        hostelId: user.hostelId,
        hostelName: hostel.name,
        status: user.status,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.patch('/staff/:id', async (req, res, next) => {
  try {
    const data = z
      .object({
        status: z.enum(['ACTIVE', 'DISABLED']).optional(),
        role: z.enum(['HOSTEL_MANAGER', 'HOSTEL_STAFF']).optional(),
      })
      .parse(req.body);

    const user = await User.findOneAndUpdate(
      { _id: req.params.id, role: { $in: ['HOSTEL_MANAGER', 'HOSTEL_STAFF'] } },
      { $set: data },
      { new: true }
    );
    if (!user) {
      res.status(404).json({ error: 'Staff member not found' });
      return;
    }
    res.json({ staff: user });
  } catch (err) {
    next(err);
  }
});

router.get('/audit', async (_req, res, next) => {
  try {
    const logs = await AuditLog.find().sort({ createdAt: -1 }).limit(50).lean();
    const actorIds = [...new Set(logs.map((l) => l.actorId?.toString()).filter(Boolean))];
    const hostelIds = [...new Set(logs.map((l) => l.hostelId?.toString()).filter(Boolean))];
    const [actors, hostels] = await Promise.all([
      User.find({ _id: { $in: actorIds } }).select('_id nickname email').lean(),
      Hostel.find({ _id: { $in: hostelIds } }).select('_id name').lean(),
    ]);
    const aMap = new Map(actors.map((a) => [a._id.toString(), a]));
    const hMap = new Map(hostels.map((h) => [h._id.toString(), h.name]));

    res.json({
      logs: logs.map((l) => {
        const actor = l.actorId ? aMap.get(l.actorId.toString()) : null;
        return {
          _id: l._id,
          action: l.action,
          actorRole: l.actorRole,
          actorName: actor?.nickname ?? 'System',
          hostelName: l.hostelId ? (hMap.get(l.hostelId.toString()) ?? null) : null,
          targetType: l.targetType,
          createdAt: l.createdAt,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

export default router;
